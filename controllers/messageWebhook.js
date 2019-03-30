const processMessage = require("../helpers/processMessage");

module.exports = (req, res) => {
  console.log("message webhook called");
  if (req.body.object === "page") {
    req.body.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message && event.message.text) {
          console.log("processing");
          processMessage(event);
        }
      });
    });
    res.status(200).end();
  }
};
