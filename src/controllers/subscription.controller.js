import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel id")
    if(!req.user?._id) throw new ApiError(401, "Unauthorized access")

    const subscriberId = req.user?._id

    const isSubscribed = await Subscription.findOne({subscriber: subscriberId, channel: channelId})
    let response;
    try {
        response = isSubscribed ? Subscription.deleteOne({channel: channelId, subscriber: subscriberId}) : Subscription.create({channel: channelId, subscriber: subscriberId})
    } catch (error) {
        console.error("Error while toggling  subscription ", error);
        throw new ApiError(500, error?.message || "Internal server error")
    }

    res.status(200).json(
        new ApiResponse(200, response, isSubscribed === null ? "Subscribed Successfully" : "Unsubscribed Successfully")
    )

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if(!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel id")
    if(!req.user?._id) throw new ApiError(401, "Unauthorized access")
    
    const pipeline = [
        {
            $match: new mongoose.Types.ObjectId(channelId)
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
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
                subscriber: {
                    $first: "$subscriber"
                }
            }
        }
    ]

    try {
        const subscribers = await Subscription.aggregate(pipeline);
        const subscribersList = subscribers.map(item => item.subscriber)
        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    subscribersList,
                    "Subscribers List fetched successfully"
                )

            )
    } catch (error) {
        console.log("getUserSubscribedChannels error ::", error)
        throw new ApiError(
            500,
            error?.message || "Internal server error in getUserSubscribedChannels")
    }
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if(!isValidObjectId(subscriberId)) throw new ApiError(400, "Invalid subscriber id")
    if (!req.user?._id) throw new ApiError(401, "Unauthorized access")
    
    const pipeline = [
        {
            $match: new mongoose.Types.ObjectId(subscriberId)
            
        },
        {
            $lookup: {
                from: "users",
                localField : "channel",
                foreignField : "_id",
                as: "subscribedTo",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar:1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$subscribedTo"
        },
        {
            $project: {
                subscribedChannels: "$subscribedTo"
            }
        }
    ]

    try {
        const channelSubscribedTo = await Subscription.aggregate(pipeline);
        const channelSubscribedToList = channelSubscribedTo.map(item => item.subscribedChannels)

        return res.status(200).json(
            new ApiResponse(200, channelSubscribedToList, "Successfully fetched subscribed channels list of a user")
        )
    } catch (error) {
        console.error("Error while fetching subscribed channels list of a user ",error);
        throw new ApiError(500, error?.message || "Internal server error while fetching subscribed channels list of a user")
    }
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}