const { loadVideo } = require("../utilities/load-video.utility");

exports.loadVideo = async function (req, res) {
    const data = await loadVideo();

    res.json(data);
    return;
};