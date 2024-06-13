import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import { Comment } from "../models/comment.model.js"
import { Playlist } from "../models/playlist.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary, deleteOnCloudinary} from "../utils/cloudinary.js"

const getAllVideos = asyncHandler(async (req, res) => {
    
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = 1,userId } = req.query;
 
    const matchCondition = {
        $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    };

    if (userId) {
        matchCondition.owner = new mongoose.Types.ObjectId(userId);
    }
    let videoAggregate;
    try {
        videoAggregate = Video.aggregate(
            [
                {
                    $match: matchCondition

                },

                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    _id :1,
                                    fullName: 1,
                                    avatar: "$avatar.url",
                                    username: 1,
                                }
                            },

                        ]
                    }

                },

                {
                    $addFields: {
                        owner: {
                            $first: "$owner",
                        },
                    },
                },

                {
                    $sort: {
                        [sortBy || "createdAt"]: sortType || 1
                    }
                },

            ]
        )
    } catch (error) {
        console.error("Error in aggregation:", error);
        throw new ApiError(500, error.message || "Internal server error in video aggregation");
    }

    const options = {
        page,
        limit,
        customLabels: {
            totalDocs: "totalVideos",
            docs: "videos",

        },
        skip: (page - 1) * limit,
        limit: parseInt(limit),
    }

    Video.aggregatePaginate(videoAggregate, options)
        .then(result => {
            // console.log("first")
            if (result?.videos?.length === 0 && userId) {
                return res.status(200).json(new ApiResponse(200, [], "No videos found"))
            }

            return res.status(200)
                .json(
                    new ApiResponse(
                        200,
                        result,
                        "video fetched successfully"
                    )
                )
        }).catch(error => {
            console.log("error ::", error)
            throw new ApiError(500, error?.message || "Internal server error in video aggregate Paginate")
        })




})

const publishAVideo = asyncHandler(async (req, res) => {

    const { title, description } = req.body;
    var videoFile;
    var thumbnail;
  try {
      if(!(title && description) || !(title?.trim() && description?.trim())) throw new ApiError(404, "Please provide title and description");

      if (!req.files?.videoFile?.[0]?.path && !req.files?.thumbnail?.[0]?.path) throw new ApiError(404, "Please provide video and thumbnail");


       [videoFile, thumbnail] = await Promise.all(
          [
          uploadOnCloudinary(req.files?.videoFile?.[0]?.path),
          uploadOnCloudinary(req.files?.thumbnail?.[0]?.path)
          ]
      );

      const video = await Video.create({
          title,
          description,
          videoFile: { publicId: videoFile?.public_id, url: videoFile?.url },
          thumbnail: { publicId: thumbnail?.public_id, url: thumbnail?.url },
          owner: req.user?._id,
          duration: videoFile?.duration
      })

      return res.status(201)
          .json(new ApiResponse(201,
              {
                  ...video._doc,
                  videoFile: videoFile?.url, // Only send the URL of the video file
                  thumbnail: thumbnail?.url    // Only send the URL of the thumbnail
              },
              "Video Published Successfully"
          ))
  } catch (error) {
      try {
        if(videoFile?.url) await deleteOnCloudinary(videoFile?.url, videoFile?.public_id);
        if (thumbnail?.url) await deleteOnCloudinary(thumbnail?.url, thumbnail?.public_id);

      } catch (error) {
          console.error("Error while deleting video :: ", error);
          throw new ApiError(500, error?.message || 'Server Error while deleting video from cloudinary');
      }
      console.error("Error while publishing video :: ", error);
      throw new ApiError(500, error?.message || 'Server Error while uploading video');

  }

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    try {

        if(!isValidObjectId(videoId)){
            return res.status(400).json({ error: "Invalid video id" })
        }

        const video = await Video.findById(videoId)
        
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
    const thumbnailLocalPath = req.file?.path

    if(!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id")

    const video = await Video.findById(videoId)
    if (!video) throw new ApiError(404, "Invalid Video Id")
    

    if (
        !(thumbnailLocalPath || !(!title || title?.trim() === "") || !(!description || description?.trim() === ""))
    ) {
        throw new ApiError(400, "update fields are required")
    }
    
    if (video.owner.toString() !== req.user?._id.toString()) {
        return res.status(403).json(
            new ApiResponse(403, "Unauthorized: You are not the owner of this video!")
        );
    }

    const updatedThumbnail  = await uploadOnCloudinary(thumbnailLocalPath)
    if(!updatedThumbnail) throw new ApiError(500, "Error", error)

    const {publicId, url} = video?.thumbnail;
    if (!(publicId || url)) throw new ApiError(500, "old thumbnail url or publicId not found");

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                title,
                description,
                thumbnail: {
                    publicId: updatedThumbnail?.public_id,
                    url: updatedThumbnail?.url
                }
            }
        },
        {
            new: true
        }
    )

    if(!updatedVideo){
        await deleteOnCloudinary(updatedThumbnail.url,  updatedThumbnail?.public_id)
        console.error("Error while updating video");
        throw new ApiError(500, "Error While Updating the Video")
    }

    if(url){
        try {
            await deleteOnCloudinary(url, publicId)
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
        
        const deleteVideoFilePromise = await deleteOnCloudinary(video.videoFile.url, video.videoFile.publicId)
        const deleteThumbnailPromise = await deleteOnCloudinary(video.thumbnail.url, video.thumbnail.publicId)
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
        console.error("Error while deleting the video", error);

        // try {
        //     if(deleteVideoFilePromise?.error) await deleteVideoFilePromise.retry()
        //     if(deleteThumbnailPromise?.error) await deleteThumbnailPromise.retry()
        // } catch (cloudinaryError) {
        //     console.error('Error while deleting the video',cloudinaryError)
        // }

        throw new ApiError(500, error?.message || "Internal Server Error while deleting the video")
    }


})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id")
    
    const video = await Video.findById(videoId, {  isPublished: 1, owner: 1, })
console.log(video);
    if(req.user?._id.toString() !== video?.owner?._id.toString()) throw new ApiError(401, "Unauthorized Request")
    
    const toggleVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:
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