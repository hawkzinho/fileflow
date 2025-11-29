const express = require('express');
const roomController = require('../controllers/roomController');

const router = express.Router();

router.post('/', roomController.createRoom);
router.get('/', roomController.getUserRooms);
router.get('/:roomId/messages', roomController.getRoomMessages);
router.get('/:roomId/members', roomController.getRoomMembers);
router.get('/:roomId/files', roomController.getRoomFiles);
router.post('/:roomId/invite', roomController.inviteToRoom);
router.put('/:roomId/active', roomController.setRoomActive);

module.exports = router;