const router = require("express").Router();
const loadVideo = require("./load-video.api");

router.use("/load-video", loadVideo);


module.exports = router;
