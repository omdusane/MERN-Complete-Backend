import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {Video} from "../models/video.model.js"
import { User } from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {

    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id")

    const video = await Comment.findById(videoId, {_id:1})
    if(!video) throw new ApiError(404, "Video not found")

    let commentAggregate;
    try {
        commentAggregate = Comment.aggregate([
            {
                $match: {
                    video: new mongoose.Types.ObjectId(videoId)
                }       
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id", 
                    as : "owner",
                    pipeline:[
                        {
                            $project:{
                                _id:1,
                                username:1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    owner: {
                        $first: "$owner"
                    }
                }
            },
            {
                $sort : {
                    "createdAt": -1
                }
            }
        ])
    } catch (error) {
        console.error("Error while forming aggregation pipeline : ", error);
        throw new ApiError(500, error.message || "Internal Server error in comment aggregation")
    }

    const options = {
        page,
        limit,
        customLabels: {
            docs: "comments",
            totalDocs: "totalComments",

        },
        skip: (page - 1) * limit,
        limit: parseInt(limit),
    }

    Comment.aggregatePaginate(
        commentAggregate,
        options
    ).then(result => {
        if(result?.comments.length === 0){
            return res.status(200).json(
                new ApiResponse(200, [], "No comments found")
            )
        }
        return res.status(200).json(
            new ApiResponse(200, result, "Success")
        )
    }).catch(error => {
        console.error("Error while paginating",error);
        throw new ApiError(500, error.message || "Internal Server Error")
    })

})

const addComment = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const {content} = req.body
    
    if(!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id")
    if(content?.trim()==="") throw new ApiError(400, "Content cannot be empty")
    
    const [video, user] = Promise.all([
        Video.findById(videoId),
        User.findById(req.user?._id)
    ])

    if(!user) throw new ApiError(400, "User not found")
    if(!video) throw new ApiError(400, "Video not found")

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    })

    if(!comment) throw new ApiError(400, "Error while creating new comment")
    
    return res.status(201).json(
        new ApiResponse(201, comment, "Comment Created Successfully")
    )

})

const updateComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    const {content} = req.body
    
    if(!isValidObjectId(commentId)) throw new ApiError(400, "Invalid video id")
    if(content?.trim()==="") throw new ApiError(400, "Content cannot be empty")
    
    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set:
            {
                content
            }
        },
        {
            new: true
        }
    )
    
    if(!updatedComment) throw new ApiError(400, "Error while updating new comment")
    
    res.status(200).json(
        new ApiResponse(200, updatedComment, "Comment Updated Successfully")
    )
})

const deleteComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    
    if(!isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment id")
    
    const comment = Comment.findById(commentId)
    if(!comment) throw new ApiError(400, "Comment not found")
    if(comment.owner.toString() !== req.user?._id.toString()) throw new ApiError(401, "Unauthorized Request")

    const deleteComment = await Comment.findByIdAndDelete(commentId, {new: true})

    if(!deleteComment) throw new ApiError(400, "Error while deleting comment")
    
    res.status(200).json(
        new ApiResponse(200, deleteComment, "Comment Deleted Successfully")
    )
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }