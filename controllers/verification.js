module.exports = (req, res) => {
  const hubChallenge = req.query["hub.challenge"];

  const hubMode = req.query["hub.mode"];
  const verifyTokenMatches = req.query["hub.verify_token"] === "foodbot";

  if (hubMode && verifyTokenMatches) {
    console.log("verifying");
    res.status(200).send(hubChallenge);
  } else {
    res.status(403).end();
  }
};
