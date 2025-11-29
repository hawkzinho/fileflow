const express = require('express');
const friendController = require('../controllers/friendController');

const router = express.Router();

router.post('/request', friendController.sendFriendRequest);
router.post('/request/:friendshipId/accept', friendController.acceptFriendRequest);
router.get('/requests/pending', friendController.getPendingRequests);
router.get('/', friendController.getFriends);
router.delete('/:friendshipId', friendController.removeFriend);
router.get('/search', friendController.searchUsers);

module.exports = router;