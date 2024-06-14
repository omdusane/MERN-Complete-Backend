import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {User} from "../models/user.model.js"
import {Video} from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
    if(!(name || description) || !(name.trim() !== "" || description.trim() !=="")) throw new ApiError(400,"name and description is required")
    
    const user = await User.findById(req.user?._id, {_id:1})
    if(!user) throw new ApiError(404, "User not found")
    
    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user?._id
    })

    if(!playlist) throw new ApiError(500, "Error While creating Playlist")
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    if(!isValidObjectId(userId)) throw new ApiError(401, 'Invalid user id')
    
    const playlist = await Playlist.findOne({owner:userId})
    if(!playlist) throw new ApiError(404, "Playlist not Found")
    
    const playlistAggregate = await Playlist.aggregate([
        {
            $match:{
                $owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $lookup: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    username:1,
                                    fullName:1,
                                    avatar:1,
                                    _id:1
                                }
                            }
                        ]
                    },
                    {
                        $addFields: {
                            videoOwner: {
                                $first: "$owner"
                            }
                        }
                    },
                    {
                        $unset: "owner"
                    },
                    
                ]
            }
        },
        {
            $unwind: "$videos"
        }
    ])

    if(!playlistAggregate) throw new ApiError(404, "Playlist not Found")
    
    res.status(200).json(
        new ApiResponse(200, playlistAggregate, "Playlist Fetched Successfully")
    )
    
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid Playlist id")
    
    const playlist = await Playlist.findById(playlistId, {_id:1})
    if(!playlist) throw new ApiError(404, "Playlist not found")
    
    const playlistAggregate = await Playlist.aggregate([
        {
            $match: new mongoose.Types.ObjectId(playlistId)
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $match: {deleted: {$ne:true}}
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
                                        fullName:1,
                                        username:1,
                                        avatar:1,
                                        _id:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            videoOwner: {
                                $first: "$owner"
                            }
                        }
                    },
                    {
                        $project: {
                            owner:0
                        }
                    },

                ]
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline:[
                    {
                        $project: {
                            username: 1,
                            fullName:1,
                            avatar:1,
                            _id:1
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
        }
    ])

    if(!playlistAggregate) throw new ApiError(404, "Playlist not found")

    return res.status(200).json(
        new ApiResponse(200, playlistAggregate, "Playlist fetched successfully")
    )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) throw new ApiError(400, "Invalid Playlist or video id")
    
    const playlist = await Playlist.findById(playlistId)
    if(!playlist) throw new ApiError(404, "Playlist not found")
    
    const video = await Video.findById(videoId)
    if(!video) throw new ApiError(404, "Video not found")
    
    const user = await User.findById(req.user?._id)
    if(!user) throw new ApiError(404, "User not found")
    
    if(playlist.owner.toString() === user._id.toString()) throw new ApiError(401, "Unauthorized Request")

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )

    if(!updatedPlaylist) throw new ApiError(500, "Error while adding video to the playlist")
    
    res.status(200).json(
        new ApiResponse(200, updatePlaylist, "Video added to playlist successfully")
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    
    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) throw new ApiError(400, "Invalid Playlist or video id")
    
    const playlist = await Playlist.findById(playlistId)
    if(!playlist) throw new ApiError(404, "Playlist not found")
    
    const video = await Video.findById(videoId)
    if(!video) throw new ApiError(404, "Video not found")
    
    const user = await User.findById(req.user?._id)
    if(!user) throw new ApiError(404, "User not found")
    
    const isVideoInPlaylist = await Playlist.findOne({_id: playlistId, videos: videoId})
    if(!isVideoInPlaylist) throw new ApiError(404, "Video not found in the playlist")
    
    if(playlist.owner.toString() === user._id.toString()) throw new ApiError(401, "Unauthorized Request")
    
    const removedVideoPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )
    
    if(!removedVideoPlaylist) throw new ApiError(500, "Error while removing video from the playlist")
    
    res.status(200).json(
        new ApiResponse(200, removedVideoPlaylist, "Video Removed from the playlist Successfully")
    )
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)) throw  new ApiError(400, "Invalid Playlist id")
    
    const playlist = await Playlist.findById(playlistId)
    if(!playlist) throw new ApiError(404, "Playlist not found")
    
    const user = await User.findById(req.user?._id)
    if(!user) throw new ApiError(404, "User not found")
    
    if(playlist.owner.toString() !== user._id.toString())  throw new ApiError(401, "Unauthorized Request")

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)
    if(!deletedPlaylist) throw new ApiError(500, "Error while deleting playlist")
    
    res.status(200).json(new ApiResponse(200, deletedPlaylist, "Playlist Deleted Successfully"))

})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    if(!isValidObjectId(playlistId))  throw new ApiError(400, "Invalid Playlist id")
    
    if (!(name || description) || !(name?.trim() !== "" || description?.trim() !== "")) throw new ApiError(400, "name or description required");

    const playlist = await  Playlist.findById(playlistId)
    if(!playlist) throw new ApiError(404, "Playlist not found")
    
    if(playlist.owner.toString() !== req.user?._id.toString()) throw new ApiError(401, "Unauthorized Request")
    
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name,
                description
            }
        },
        {
            new: true
        }
    )
    if(!updatedPlaylist) throw new ApiError(500, "Error while updating playlist")
    
    return res.status(200).json(new ApiResponse(200, updatedPlaylist, "Playlist Updated Successfully"))
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}