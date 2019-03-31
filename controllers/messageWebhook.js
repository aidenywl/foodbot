const processMessage = require("../helpers/processMessage");

module.exports = (req, res) => {
  // console.log("message webhook called");
  // console.log("REQ:", req.body.entry[0].messaging);
  // // const url = req.body.entry[0].messaging[0].message.attachments[0].payload.url;
  // // console.log("request is:", url);
  // console.log("END");
  if (req.body.object === "page") {
    req.body.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message) {
          processMessage(event);
        }
      });
    });
    res.status(200).end();
  }
};
