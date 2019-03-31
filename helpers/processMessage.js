const MODES = require("./modes");

const fetch = require("node-fetch");

const projectId = "newagent-75c13";
const sessionId = "123456";
const languageCode = "en-US";

const dialogflow = require("dialogflow");

const config = {
  credentials: {
    private_key: process.env.DIALOGFLOW_PRIVATE_KEY,
    client_email: process.env.DIALOGFLOW_CLIENT_EMAIL
  }
};
const sessionClient = new dialogflow.SessionsClient(config);

const sessionPath = sessionClient.sessionPath(projectId, sessionId);

const { FACEBOOK_ACCESS_TOKEN } = process.env;

const sendTextMessage = (userId, text) => {
  console.log("SENDING TEXT MESSAGE");
  return fetch(
    `https://graph.facebook.com/v2.6/me/messages?access_token=${FACEBOOK_ACCESS_TOKEN}`,
    {
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: {
          id: userId
        },
        message: {
          text
        }
      })
    }
  );
};

const generateMessageText = (location, remarks) => {
  return `Free Food!\n\nLocation:\n\n${location}\n\nOrganiser Remarks:\n${remarks}`;
};

const sendEventMessage = (userId, location, url, remarks) => {
  console.log("SENDING EVENT MESSAGE");
  const message = generateMessageText(location, remarks);
  sendTextMessage(userId, message);
  return fetch(
    `https://graph.facebook.com/v2.6/me/messages?access_token=${FACEBOOK_ACCESS_TOKEN}`,
    {
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: {
          id: userId
        },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: url,
              is_reusable: true
            }
          }
        }
      })
    }
  );
};
const activeUsersAndMode = {};

const activeEvents = [];

const eventStaging = {};

module.exports = event => {
  const userId = event.sender.id;
  const message = event.message.text;
  const attachments = event.message.attachments;
  console.log(userId);

  // get the current user mode.
  const currentUserMode = activeUsersAndMode[userId];
  console.log("current user mode is: ", currentUserMode);
  // switch (currentUserMode) {
  //   case (null):
  //     // at the start, give an initial prompt.

  // }

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode: languageCode
      }
    }
  };

  if (!currentUserMode) {
    console.log("MODE: NO CURRENT USER MODE");
    sessionClient
      .detectIntent(request)
      .then(responses => {
        console.log("RESPONSES ARE: ", responses);
        const result = responses[0].queryResult;
        const intent = result.action;
        switch (intent) {
          case "welcome":
            activeUsersAndMode[userId] = MODES.INITIAL;
            break;
          case "share":
            activeUsersAndMode[userId] = MODES.LOCATION_PROMPT;
            break;
          case "find":
            activeUsersAndMode[userId] = MODES.FIND;
            if (activeEvents === undefined || activeEvents.length === 0) {
              return sendTextMessage(
                userId,
                "There are no free food currently available near your location :(."
              );
            }
            activeEvents.forEach(event => {
              const { locationText, remarks, imageURL } = event;
              sendEventMessage(userId, locationText, imageURL, remarks);
            });
            break;
          default:
            activeUsersAndMode[userId] = MODES.INITIAL;
        }
        return sendTextMessage(userId, result.fulfillmentText);
      })
      .catch(err => {
        console.error("ERROR:", err);
      });
  }

  switch (currentUserMode) {
    case MODES.INITIAL:
      console.log("MODE: INITIAL");
      sessionClient
        .detectIntent(request)
        .then(responses => {
          const result = responses[0].queryResult;
          const intent = result.action;
          switch (intent) {
            case "share":
              activeUsersAndMode[userId] = MODES.LOCATION_PROMPT;
              return sendTextMessage(userId, result.fulfillmentText);
            case "find":
              activeUsersAndMode[userId] = MODES.FIND;

              break;
            default:
              activeUsersAndMode[userId] = MODES.INITIAL;
              return sendTextMessage(userId, result.fulfillmentText);
          }
        })
        .catch(err => {
          console.error("ERROR:", err);
        });
      break;
    case MODES.FIND:
      sessionClient.detectIntent(request).then(responses => {
        const result = responses[0].queryResult;
        const intent = result.action;
        if (intent === "reset") {
          activeUsersAndMode[userId] = MODES.INITIAL;
        }
        if (activeEvents === undefined || activeEvents.length === 0) {
          return sendTextMessage(
            userId,
            "There are no free food currently available near your location :(."
          );
        }
        activeEvents.forEach(event => {
          const { userId, locationText, remarks, imageURL } = event;
          sendEventMessage(userId, locationText, imageURL, remarks);
        });
      });
      break;
    case MODES.LOCATION_PROMPT:
      console.log("MODE: LOCATION_PROMPT");

      // get the full string and just save it.
      eventStaging[userId] = {
        locationText: message,
        userId: userId
      };
      activeUsersAndMode[userId] = MODES.PHOTO_PROMPT;
      return sendTextMessage(
        userId,
        "Please take a photo of your food and send it!"
      );
    case MODES.PHOTO_PROMPT:
      console.log("MODE: PHOTO_PROMPT");
      console.log(attachments);
      if (
        !attachments ||
        !attachments[0] ||
        !attachments[0].payload ||
        !attachments[0].payload.url
      ) {
        return sendTextMessage(
          userId,
          "Please send us a photo of the food you want to share!"
        );
      }

      const url = attachments[0].payload.url;
      eventStaging[userId] = { ...eventStaging[userId], imageURL: url };
      activeUsersAndMode[userId] = MODES.REMARK_PROMPT;
      return sendTextMessage(userId, "Say something for the people coming!");
    case MODES.REMARK_PROMPT:
      console.log("MODE: REMARK_PROMPT");

      // take the string and store.
      eventStaging[userId] = { ...eventStaging[userId], remarks: message };
      activeUsersAndMode[userId] = MODES.INITIAL;
      // transfer event from staging to actual.
      activeEvents.push(eventStaging[userId]);
      eventStaging[userId] = undefined;
      return sendTextMessage(
        userId,
        "Thank you. Your food details will be sent out!"
      );
    default:
      sessionClient
        .detectIntent(request)
        .then(responses => {
          const result = responses[0].queryResult;
          return sendTextMessage(userId, result.fulfillmentText);
        })
        .catch(err => {
          console.error("ERROR:", err);
        });
  }
};
