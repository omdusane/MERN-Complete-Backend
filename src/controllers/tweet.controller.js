import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const {content} = req.body;
    if(!content || content.trim() === "") throw new ApiError(400, "Content is required")
    
    const user = await User.findById(req.user?._id, {_id:1})
    if(!user) throw new ApiError(404, "User not found")
    
    const tweet = await Tweet.create({
        content,
        owner: req.user?._id
    })

    if(!tweet) throw new ApiError(500, "Something went weong while posting the tweet")
    
    res.status(201).json(
        new ApiResponse(201, tweet, "Tweet created successfully")
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    const {userId} = req.params;
    if(!userId) throw  new ApiError(400, "User Id is required")
    if(!isValidObjectId(userId)) throw new ApiError(400, "Invalid user id")
    
    const user = User.findById(userId).select("_id")
    if(!user) throw new ApiError(404, "User not found")
    
    const {page=1, limit=10} = req.query

    const tweetAggregate = Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(user?._id)
            }
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
                            username:1,
                            avatar:1,
                            _id:1,
                            fullName:1
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
            $sort:{
                createdAt:-1
            }
        }
    ])

    if(!tweetAggregate) throw new ApiError(404, "No tweets found")
    
        const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
            totalDocs: "totalTweets",
            docs: "tweets"
        },
        $skip: (page - 1) * limit

    }

    Tweet.aggregatePaginate(
        tweetAggregate,
        options
    ).then(result => {
        if(result.length === 0){
            return res.status(200).json(
                new ApiResponse(200, result, "No tweets found")
            )
        }
        return res.status(200).json(new ApiResponse(200, result, "Successfully fetched the tweets"))
    })
})

const updateTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params;
    const {content} = req.body;

    if(!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id")
    if(!content || content.trim() === "") throw new ApiError(400, "Content is required")
    
    const user = User.findById(req.user?._id,  {_id:1})
    const tweet = Tweet.findById(tweetId)

    if(!user) throw new ApiError(404, "User not found")
    if(!tweet) throw new ApiError(404, "No tweets found")
    
    if(user._id.toString() !== user.owner[0]._id.toString()) throw new ApiError(403, "You are not allowed to update this tweet")
    
    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set:{
                content
            }
        },
        {
            new: true
        }
    )

    if(!updatedTweet) throw new ApiError(500, "Something went wrong while updating the tweet")
    
    res.status(200).json(
        new ApiResponse(200, updatedTweet, "Successfully updated the tweet")
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
    
    const {tweetId} = req.params;
    if(!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id")

    const user = User.findById(req.user?._id,  {_id:1})
    const tweet = Tweet.findById(tweetId)

    if(!user) throw new ApiError(404, "User not found")
    if(!tweet) throw new ApiError(404, "No tweets found")
    
    if(user._id.toString() !== user.owner[0]._id.toString()) throw new ApiError(403, "You are not allowed to delete this tweet")
    
    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
    if(!deletedTweet) throw new ApiError(500, "Something went wrong while deleting the tweet")
    
    return res.status(200).json(
        new ApiResponse(200, deletedTweet, "Successfully deleted the tweet")
    )
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}