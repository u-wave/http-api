import joi from 'joi';

const objectID = joi.string().length(24);
const userName = joi.string()
  .min(3).max(32)
  .regex(/^[^\s\n]+$/);
const userEmail = joi.string().email();
const userPassword = joi.string().min(6);

const newStylePagination = joi.object({
  page: joi.object({
    offset: joi.number().min(0),
    limit: joi.number().min(0),
  }),
});
const oldStylePagination = joi.object({
  page: joi.number().min(0),
  limit: joi.number().min(0),
});
const pagination = [
  newStylePagination,
  oldStylePagination,
];

// Validations for authentication routes:

export const register = joi.object({
  body: joi.object({
    email: userEmail.required(),
    username: userName.required(),
    password: userPassword.required(),
  }),
});

export const login = joi.object({
  body: joi.object({
    email: userEmail.required(),
    password: joi.string().required(),
  }),
});

export const requestPasswordReset = joi.object({
  body: joi.object({
    email: userEmail.required(),
  }),
});

export const passwordReset = joi.object({
  body: joi.object({
    email: userEmail.required(),
    password: userPassword.required(),
  }),
});

// Validations for booth routes:

export const skipBooth = joi.object({
  body: joi.object({
    reason: joi.string().allow(''),
    userID: objectID,
    remove: joi.bool(),
  }).and('userID', 'reason'),
});

export const replaceBooth = joi.object({
  body: joi.object({
    userID: objectID.required(),
  }),
});

export const favorite = joi.object({
  body: joi.object({
    playlistID: objectID.required(),
    historyID: objectID.required(),
  }),
});

export const getRoomHistory = joi.object({
  query: pagination,
});

// Validations for chat routes:

export const deleteChatByUser = joi.object({
  params: joi.object({
    id: objectID.required(),
  }),
});

export const deleteChatMessage = joi.object({
  params: joi.object({
    id: joi.string().required(),
  }),
});

// Validations for MOTD routes:

export const setMotd = joi.object({
  body: joi.object({
    motd: joi.string().required(),
  }),
});

// Validations for playlist routes:

const playlistParams = joi.object({
  id: objectID.required(),
});

const playlistItemParams = joi.object({
  id: objectID.required(),
  itemID: objectID.required(),
});

export const createPlaylist = joi.object({
  body: joi.object({
    name: joi.string().required(),
  }),
});

export const getPlaylist = joi.object({
  params: playlistParams,
});

export const deletePlaylist = joi.object({
  params: playlistParams,
});

export const updatePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    name: joi.string(),
    shared: joi.bool(),
    description: joi.string(),
  }),
});

export const renamePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    name: joi.string().required(),
  }),
});

export const sharePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    shared: joi.bool().required(),
  }),
});

export const getPlaylistItems = joi.object({
  params: playlistParams,
  query: pagination,
});

export const addPlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: joi.array().required(),
  }),
});

export const removePlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: joi.array().required(),
  }),
});

export const movePlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: joi.array().required(),
    after: [
      objectID, // Insert after ID
      joi.number().valid(-1), // Prepend
    ],
  }),
});

export const shufflePlaylistItems = joi.object({
  params: playlistParams,
});

export const getPlaylistItem = joi.object({
  params: playlistItemParams,
});

export const updatePlaylistItem = joi.object({
  params: playlistItemParams,
  body: joi.object({
    artist: joi.string(),
    title: joi.string(),
    start: joi.number().min(0),
    end: joi.number().min(0),
  }),
});

export const removePlaylistItem = joi.object({
  params: playlistItemParams,
});

// Validations for user routes:

const userParams = joi.object({
  id: objectID.required(),
});

export const getUser = joi.object({
  params: userParams,
});

export const muteUser = joi.object({
  params: userParams,
  body: joi.object({
    time: joi.number().min(0).required(),
  }),
});

export const unmuteUser = joi.object({
  params: userParams,
});

export const setUserRole = joi.object({
  params: userParams,
  body: joi.object({
    role: joi.number().min(0).max(4).required(),
  }),
});

export const setUserName = joi.object({
  params: userParams,
  body: joi.object({
    username: userName,
  }),
});

export const setUserAvatar = joi.object({
  params: userParams,
  body: joi.object({
    avatar: joi.string(),
  }),
});

export const setUserStatus = joi.object({
  params: userParams,
  body: joi.object({
    status: joi.number(),
  }),
});

export const getUserHistory = joi.object({
  params: userParams,
  query: pagination,
});

// Validations for Waitlist routes:

export const joinWaitlist = joi.object({
  body: joi.object({
    userID: objectID.required(),
  }),
});

export const moveWaitlist = joi.object({
  body: joi.object({
    userID: objectID.required(),
    position: joi.number().min(0).required(),
  }),
});

export const lockWaitlist = joi.object({
  body: joi.object({
    lock: joi.bool().required(),
  }),
});
