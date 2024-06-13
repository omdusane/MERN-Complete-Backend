import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import { Comment } from "../models/comment.model.js"
import { Playlist } from "../models/playlist.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query

    const matchCondition = {}

    if(query){
        matchCondition.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    }

    if(userId){
        matchCondition.owner = userId
    }

    const sortOptions = {};
    if(sortType && sortBy){
        sortOptions[sortBy] = sortType === "desc" ? -1 : 1;
    }

    const videos = await Video.aggregatePaginate(matchCondition, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: sortOptions
    });

    return res.status(200).json(
        new ApiResponse(200, videos, "Videos retrived successfully")
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body

    try {
        if(!(title && description) || !(title?.trim() && description?.trim())) throw new ApiError(404, "Please provide title and description")
        if(!req.files?.videoFile?.[0]?.path && !req.files?.thumbnail?.[0].path) throw new ApiError(404, "Please provide video and thumbnail file")    
        
        const videoFile = await uploadOnCloudinary(req.files?.videoFile?.[0]?.path)
        const thumbnail = await uploadOnCloudinary(req.files?.thumbnail?.[0].path)

        const newVideo = await Video.create({
            videoFile : videoFile.url,
            thumbnail : thumbnail.url,
            title,
            description,
            duration: videoFile.duration,
            owner: req.user?._id,
        });
        
        return res.status(201).json(
            new ApiResponse(201, newVideo, 'Video Published Successfully')
        )

    } catch (error) {
        console.error("Error While Publishing the video ",error);
        return res.status(500).json(
            new ApiResponse(500, "Internal Server Error")
        )
    }

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    try {

        if(!isValidObjectId(videoId)){
            return res.status(400).json({ error: "Invalid video id" })
        }

        const video = await Video.findById({videoId})

        if(!video){
            throw new ApiError(404, "Video not Found")
        }

        res.status(200).json(
            new ApiResponse(200, video, "Video retrived successfully")
        )

    } catch (error) {
        throw new ApiError(500, "Error While retriving video", error)
    }
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    const thumbnailLocalPath = req.files?.path

    if(!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id")

    const video = await Video.findById(videoId)
    if (!video) throw new ApiError(404, "Invalid Video Id")
    

    if (
        !(thumbnailLocalPath || !(!title || title?.trim() === "") || !(!description || description?.trim() === ""))
    ) {
        throw new ApiError(400, "update fields are required")
    }
    
    if (video.owner.toString() !== req.user?._id) {
        return res.status(403).json(
            new ApiResponse(403, "Unauthorized: You are not the owner of this video!")
        );
    }

    const updatedThumbnail  = await uploadOnCloudinary(thumbnailLocalPath)
    if(!updatedThumbnail) throw new ApiError(500, "Error", error)

    const oldthumbnailurl = video.thumbnail;
    if(!oldthumbnailurl) throw new ApiError(404, "Old thumbnail url not found")

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                title,
                description,
                thumbnail: updatedThumbnail.url
            }
        },
        {
            new: true
        }
    )

    if(!updatedVideo){
        await deleteOnCloudinary(updatedThumbnail.url)
        console.error("Error while updating video");
        throw new ApiError(500, "Error While Updating the Video")
    }

    if(oldthumbnailurl){
        try {
            await deleteOnCloudinary(oldthumbnailurl)
        } catch (error) {
            console.error("Error while deleting old thumbnail from the cloudinary", error);
            throw  new ApiError(500, error?.message || "Internal Server Error")
        }
    }

    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video Updated Successfully")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    try {
        if(!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id")
        
        const video = await Video.findById(videoId, {videoFile: 1, thumbnail: 1}).select('_id videoFile thumbnail')
    
        if(!video){
            throw new ApiError(404, "No Video Found")
        }
    
        [deleteVideoFilePromise, deleteThumbnailPromise] = await Promise.all([
            await deleteOnCloudinary(video.videoFile),
            await deleteOnCloudinary(video.thumbnail)
        ])
    
        await Video.findByIdAndDelete(videoId)
    
        const updataPromises = [
            User.updateMany({ watchHistory: videoId }, { $pull: { watchHistory: videoId }}),
            Comment.deleteMany({video: videoId}),
            Playlist.updateMany({ videos: videoId}, { $pull: { videos: videoId }}),
            Like.deleteMany({video: videoId})
        ]
    
        await Promise.all(updataPromises)
    
        return res.status(201).json(
            new ApiResponse(201,{}, "Video Deleted Successfully")
        )
    } catch (error) {
        console.error("Error while deleting the video, Retrying... ", error);

        try {
            if(deleteVideoFilePromise?.error) await deleteVideoFilePromise.retry()
            if(deleteThumbnailPromise?.error) await deleteThumbnailPromise.retry()
        } catch (cloudinaryError) {
            console.error('Error while deleting the video',cloudinaryError)
        }

        throw new ApiError(500, error?.message || "Internal Server Error while deleting the video")
    }


})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id")
    
    const video = await Video.findById(videoId, { _id, isPublished: 1, owner: 1, })

    if(req.user?._id.toString() !== video?.owner?._id.toString()) throw new ApiError(401, "Unauthorized Request")

    const toggleVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $ser:
            {
                isPublished: !video?.isPublished
            }
        },
        { 
            new: true
        }
    )

    if(!toggleVideo) throw new ApiError(500, "Error While Toggling The Publish Status")
    
    res.status(200).json(
        201,
        toggleVideo,
        toggleVideo?.isPublished ? "video published successfully!" : "video unpublished successfully!"
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}