const { loadVideo, createEmbeddings } = require("../utilities/load-video.utility");

exports.loadVideo = async function (req, res) {
    const data = await loadVideo();

    res.json(data);
    return;
};

exports.createEmbeddings = async function (req, res) {
    const data = await createEmbeddings();

    res.json(data);
    return;
}