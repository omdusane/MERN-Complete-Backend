import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"
import {Tweet} from '../models/tweet.model.js'
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleLike = async (Model, resourceId, userId) => {
    
    if(!isValidObjectId(userId)) throw new ApiError(400,"Invalid userId")
    if(!isValidObjectId(resourceId)) throw new ApiError(400,"Invalid resourceId")
    
    const resource = await Model.findById(resourceId)
    if(!resource) throw new ApiError(404,"Resource not found")
    
    const resourceField = Model.modelName.toLowerCase()

    const isLiked = await Like.findOne({[resourceField]: resourceId, likedBy: userId})

    let response;
    try {
        response = isLiked ? Like.deleteOne({[resourceField]: resourceId, likedBy: userId}) : Like.create({[resourceField]: resourceId, likedBy: userId})
    } catch (error) {
        console.error("Togglelike error: ", error);
        throw new ApiError(500, error.message || "Internal Server Error in toggle like controller")
    }
    const totalLikes = await Like.countDocuments({[resourceField]: resourceId})

    return {response, totalLikes, isLiked}
}

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const {response, totalLikes, isLiked} = await toggleLike(Video, videoId, req.user?._id)

    res.status(200).json(
        new ApiResponse(200, {response, totalLikes}, isLiked === null ? "Liked Successfully": "Unliked Successfully" )
    )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    const {response, totalLikes, isLiked} = await toggleLike(Comment, commentId, req.user?._id)
    res.status(200).json(
        new ApiResponse(200, {response, totalLikes}, isLiked === null ? "Liked Successfully": "Unliked Successfully" )
    )
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    const {response, totalLikes, isLiked} = await toggleLike(Tweet, tweetId, req.user?._id)
    res.status(200).json(
        new ApiResponse(200, {response, totalLikes}, isLiked === null ? "Liked Successfully": "Unliked Successfully" )
    )
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new ApiError(401, "Unauthorized Request");
    const userId = req.user?._id;

    const videoPipeline = 
    [
        {
            $match: new mongoose.Types.ObjectId(userId)
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline:[
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: "$owner"
                        }
                    },
                    {
                        $addFields: {
                            videoFile:"$videoFile"
                        }
                    },
                    {
                        thumbnail:"$thumbnail"
                    }
                ]
            }
        },
        {
            $unwind: "$video"
        },
        {
            $replaceRoot: {
                newRoot: "$video"
            }
        }
    ]

    try {
        const likedVideos = await Video.aggregate(videoPipeline)
        return res.status(200).json(
            new ApiResponse(200, likedVideos, "Fetched liked videos successfully")
        )

    } catch (error) {
        console.error("Error while fetching liked videos : ", error);
        throw new ApiError(500, error.message || "Internal Server Error in get liked videos controller")
    }
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}