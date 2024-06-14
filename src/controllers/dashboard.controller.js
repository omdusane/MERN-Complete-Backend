import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new ApiError("Unauthorized request || User not found", 404);

    const userId = req.user?._id;

    try {
        const channelStats = await Video.aggregate([
            // Videos of current user
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            // subscribers
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "owner",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            // subscribedTo
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "owner",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            // likes of videos
            {   
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "video",
                    as: "likedVideos"
                }
            },
            // comments of videos
            {
                $lookup: {
                    from: "comments",
                    localField: "_id",
                    foreignField: "video",
                    as: "videoComments"
                }
            },
            // Tweets of the user
            {
                $lookup: {
                    from: "tweets",
                    localField: "owner",
                    foreignField: "owner",
                    as: "tweets"
                }
            },
            // Grouping for stats
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                    subscribers: { $first: "$subscribers" },
                    subscribedTo: { $first: "$subscribedTo" },
                    totalLikes: { $sum: { $size: "$likedVideos" } },
                    totalComments: { $sum: { $size: "$videoComments" } },
                    totalTweets: { $first: { $size: "$tweets" } },
                }
            },
            // project
            {
                $project: {
                    _id: 0,
                    totalVideos: 1,
                    totalViews: 1,
                    subscribers: { $size: "$subscribers" },
                    subscribedTo: { $size: "$subscribedTo" },
                    totalLikes: 1,
                    totalComments: 1,
                    totalTweets: 1,
                  },
            }
        ])
        res
        .status(200)
        .json(
          new ApiResponse(
            200,
            channelStats[0],
            "Channel stats fetched successfully"
          )
        );
    } catch (error) {
        console.error("Error in getChannelStats:", err);
        res.status(500).json(new ApiResponse(500, null, err.message));
    }
})

const getChannelVideos = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new ApiError("Unauthorized request || User not found", 404);

    const userId = req.user?._id;

    const videos = [
        {
            $match: {
                owner : new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: 'users',
                localField : 'owner',
                foreignKey : '_id',
                as: 'owner',
                piepline: [
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
            $unwind: "$owner"
        },
        {
            $addFields: {
                videoFile: "$videoFile.url"
            }
        },
        {
            $addFields: {
                thumbnail: "$thumbnail.url",
            }
        }
    ]

    try {
        const channelVideos = await Video.aggregate(videos);
        res.status(200).json(
            new ApiResponse(200, channelVideos,  "Successfully fetched the videos of this channel")
        )
    } catch (error) {
        console.error("Error while fetching the videos of this channel ", error);
        throw new ApiError(500, error.message || "Internal server error while fetching the videos of this channel")
    }

})

export {
    getChannelStats, 
    getChannelVideos
    }