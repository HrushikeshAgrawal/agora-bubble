let options = {
  mode: "production",
  // Mode can be development or production
  appId: "c183e2e9fd8b4036bc8466b240a066ce",
  channel: null,
  userName: null,
  role: null,
  profilePic: null,
  initialLoading: true,
  callStartTime: null,
  interval: null,
  streamVisibleCount: 0,
  isOriginalHost: false,
  pinnedUser: null,
  raisedHandCounter: 0,
};

window.onload = async function () {
  if (options.mode === "development") {
    initializeRTCClient();
    joinCall();
  }
};

// RTC
let rtc = {
  token: null,
  userName: null,
  client: null,
  videoStream: null,
  screenStream: null,
  screenClient: null,
  localStreamList: [],
};

let LOCAL_AUDIO_STREAM = true;
let LOCAL_VIDEO_STREAM = true;
let SCREEN_SHARE_STATUS = "OFF";

const initializeRTCClient = () => {
  // startLoader();
  rtc.client = AgoraRTC.createClient({
    mode: "live",
    codec: "vp8",
  });
  rtc.client.init(options.appId);

  rtc.client.on("stream-added", function (evt) {
    var stream = evt.stream;
    var uid = stream.getId();
    if (!rtc.localStreamList.includes(uid)) {
      rtc.client.subscribe(evt.stream, handleError);
    }
  });
  rtc.client.on("stream-subscribed", function (evt) {
    let stream = evt.stream;
    let streamId = String(stream.getId());
    addVideoStream(streamId);
    stream.play(streamId);
  });
  rtc.client.on("stream-removed", function (evt) {
    let stream = evt.stream;
    let streamId = String(stream.getId());
    stream.close();
    removeVideoStream(streamId);
  });
  rtc.client.on("peer-leave", function (evt) {
    let stream = evt.stream;
    let streamId = String(stream.getId());
    stream.close();
    removeVideoStream(streamId);
  });
  rtc.client.on("client-role-changed", async function (evt) {
    if (evt.role === "host") publishVideoStream();
    else if (evt.role === "audience") {
      options.streamVisibleCount--;
      updateClassName();
    }
  });
  rtc.client.on("mute-video", async function (evt) {
    var uid = evt.uid;
    toggleVideoAndThumbnail(uid, uid, "thumbnail");
  });
  rtc.client.on("unmute-video", async function (evt) {
    var uid = evt.uid;
    toggleVideoAndThumbnail(uid, uid, "video");
  });
};

const getRTCToken = async () => {
  let response = await fetch(
    `https://agorawarp.herokuapp.com/rtctoken?channel=${options.channel}`
  );
  let data = await response.json();
  rtc.token = data.token;
};

const getRTMToken = async (userName) => {
  let response = await fetch(
    `https://agorawarp.herokuapp.com/rtmtoken?user=${userName}`
  );
  let data = await response.json();
  rtm.token = data.token;
  rtmClientLogin();
};

const joinCall = async (userName, role, profilePic, session) => {
  if (options.mode === "development") {
    var url = new URL(window.location.href);
    options.role = url.searchParams.get("role");
    options.userName = url.searchParams.get("user");
    options.channel = url.searchParams.get("session");
    if (!options.userName) {
      options.userName = prompt("Enter username", "");
    }
    if (!options.role) {
      options.role = "audience";
    }
    if (!options.channel) {
      options.channel = "demo_channel_name";
    }
    if (!options.profilePic) {
      options.profilePic =
        "https://miro.medium.com/max/1200/1*mk1-6aYaf_Bes1E3Imhc0A.jpeg";
    }
  }

  if (options.mode === "production") {
    options.role = role;
    options.userName = userName;
    options.profilePic = profilePic;

    if (session) {
      options.channel = session;
    } else {
      var url = new URL(window.location.href);
      options.channel = url.searchParams.get("session");
    }

    if (!options.channel) {
      options.channel = "demo_channel_name";
    }
    if (!options.userName) {
      options.userName = prompt("Enter username", "");
    }
    if (!options.role) {
      options.role = "host";
    }

    let agoraDiv = document.getElementsByClassName("agora-div")[0];
    let bubbleDiv = agoraDiv.parentElement;
    bubbleDiv.style.height = "calc(100vh - 65px)";
    bubbleDiv.parentElement.style.height = "calc(100vh - 65px)";
    bubbleDiv.parentElement.parentElement.style.height = "calc(100vh - 65px)";
  }

  rtc.client.setClientRole(options.role);
  options.userName = options.userName.replace(/ /g, "_");
  document.getElementById("joinedAs").innerHTML +=
    " " +
    options.userName.replace(/_/g, " ") +
    " And session as " +
    options.channel;
  await getRTCToken();
  rtc.client.join(
    rtc.token,
    options.channel,
    options.userName,
    (uid) => {
      options.userName = uid;
      if (options.role == "host")
        navigator.getUserMedia(
          {
            video: true,
            audio: true,
          },
          (mediaStream) => {},
          (err) => {
            alert(
              "You have blocked audio or video for the website. Please unblock and reload."
            );
          }
        );
      if (options.role == "audience") toggleHostOnlyOptions("none");
      initializeRTMClient();
      getRTMToken(uid);
      updateClassName();
      // updatePageDisplay();
    },
    handleError
  );
};

const leaveCall = async (leaveType, pageRefresh = false) => {
  document.getElementsByClassName(
    "agora-div"
  )[0].innerHTML = `<div class="callended" ><h1>${leaveType}</h1>`;
  rtm.channel.leave();
  clearInterval(options.interval);
  await rtc.videoStream.stop();
  await rtc.videoStream.close();
  await rtc.client.leave();
  if (pageRefresh) {
    window.onbeforeunload = null;
    window.location.reload();
  } else {
    window.close();
    opener.window.focus();
  }
};

const toggleAudio = () => {
  if (LOCAL_AUDIO_STREAM) rtc.videoStream.muteAudio();
  else rtc.videoStream.unmuteAudio();
  LOCAL_AUDIO_STREAM = !LOCAL_AUDIO_STREAM;
  renameBtns();
};

const toggleVideo = () => {
  if (LOCAL_VIDEO_STREAM) {
    rtc.videoStream.muteVideo();
    toggleVideoAndThumbnail("me", options.userName, "thumbnail");
  } else {
    rtc.videoStream.unmuteVideo();
    toggleVideoAndThumbnail("me", options.userName, "video");
  }
  LOCAL_VIDEO_STREAM = !LOCAL_VIDEO_STREAM;
  renameBtns();
};

const shareScreenToggle = () => {
  if (SCREEN_SHARE_STATUS === "OFF") {
    SCREEN_SHARE_STATUS = "ON";
    shareScreen();
    document.getElementById("screenBtn").className = `fas fa-desktop redAction`;
  } else if (SCREEN_SHARE_STATUS === "ON") {
    SCREEN_SHARE_STATUS = "OFF";
    stopShareScreen();
    document.getElementById("screenBtn").className = `fas fa-desktop`;
  }
};

const renameBtns = () => {
  let audioClass = "",
    videoClass = "";
  if (LOCAL_AUDIO_STREAM) audioClass = "fa-microphone";
  else audioClass = "fa-microphone-slash";
  if (LOCAL_VIDEO_STREAM) videoClass = "fa-video";
  else videoClass = "fa-video-slash";
  document.getElementById("audioBtn").className = `fas ${audioClass}`;
  document.getElementById("videoBtn").className = `fas ${videoClass}`;
};

const shareScreen = async () => {
  if (navigator.mediaDevices.getDisplayMedia) {
    rtc.screenClient = AgoraRTC.createClient({
      mode: "live",
      codec: "vp8",
    });
    rtc.screenClient.init(options.appId);

    await getRTCToken();
    rtc.screenClient.join(
      rtc.token,
      options.channel,
      `${options.userName}-Screen`,
      (uid) => {
        rtc.localStreamList.push(uid);
        const streamSpec = {
          audio: false,
          video: false,
          screen: true,
          screenAudio: true,
        };
        rtc.screenStream = AgoraRTC.createStream(streamSpec);
        rtc.screenStream.init(function () {
          rtc.screenClient.publish(rtc.screenStream, handleError);
          addSelfScreenStream(uid);
        }, handleError);
        rtc.screenStream.on("stopScreenSharing", () => {
          stopShareScreen();
        });
      },
      handleError
    );
  }
};

const stopShareScreen = async () => {
  rtc.screenStream.stop();
  rtc.screenStream.close();
  rtc.screenClient.leave();
};

const publishVideoStream = () => {
  rtc.videoStream = AgoraRTC.createStream({
    audio: true,
    video: true,
  });
  rtc.videoStream.init(() => {
    rtc.videoStream.play("me");
    rtc.client.publish(rtc.videoStream, handleError);
    const meDiv = document.getElementById("me");
    meDiv.style.display = "flex";
    document.getElementById("meUserName").innerHTML = options.userName.replace(
      /_/g,
      " "
    );

    if (options.profilePic) {
      meDiv.getElementsByClassName(
        "tempImage"
      )[0].style.background = `url('${options.profilePic}')`;
      meDiv.getElementsByClassName("nameInitials")[0].style.display = "none";
    } else {
      meDiv.getElementsByClassName("nameInitials")[0].innerHTML =
        options.userName.charAt(0).toUpperCase();
    }

    options.streamVisibleCount++;
    toggleAudio();
    toggleVideo();
    stopLoader();
    updateClassName();
  }, handleError);
};

const handleError = (err) => {
  console.error("Error: ", err);
};

const addSelfScreenStream = (elementId) => {
  let streamName = document.createElement("h1");
  streamName.innerText = elementId;
  streamName.classList.add("streamName");

  let optionsTemplate = `
  <i class="fas fa-ellipsis-v streamOptions"onclick="showOptions('${elementId}')"></i>
  <ul class="optionsDropdown">
    <li onclick="sendMakeAudienceMessage('${elementId}')" class="hideInPopup" >Make Audience</li>
    <li onclick="sendRemoveMessage('${elementId}')">Remove</li>
    <li onclick="togglePin('${elementId}')">Pin</li>
  </ul>
  `;

  let youArePresentingH1 = document.createElement("h1");
  youArePresentingH1.innerText = "You Are Presenting";
  youArePresentingH1.classList.add("youArePresentingH1");

  let streamDiv = document.createElement("div");
  streamDiv.id = elementId;
  streamDiv.classList.add("stremeElement");
  // streamDiv.classList.add("screenStremeElement");

  streamDiv.appendChild(streamName);
  streamDiv.innerHTML += optionsTemplate;
  streamDiv.appendChild(youArePresentingH1);
  options.streamVisibleCount++;

  let remoteContainer = document.getElementById(`remote-container`);
  remoteContainer.appendChild(streamDiv);
  updateClassName();
};

const addVideoStream = async (elementId) => {
  let roleAndPic = getRoleAndPicFromName(elementId);

  let streamName = document.createElement("h1");
  streamName.innerText = elementId.replace(/_/g, " ");
  streamName.classList.add("streamName");

  let displayType = "none";
  if (options.role === "host") displayType = "flex";
  let optionsTemplate = `
  <i class="fas fa-ellipsis-v streamOptions" onclick="showOptions('${elementId}')" style="display: ${displayType}"></i>
  <ul class="optionsDropdown" style="display: none">
    <li onclick="sendMakeAudienceMessage('${elementId}')" class="hideInPopup" >Make Audience</li>
    <li onclick="sendRemoveMessage('${elementId}')">Remove</li>
    <li onclick="togglePin('${elementId}')">Pin</li>
  </ul>
  `;

  let streamDiv = document.createElement("div");
  streamDiv.id = elementId;
  streamDiv.classList.add("stremeElement");
  if (elementId.includes("-Screen"))
    streamDiv.classList.add("screenStremeElement");

  let tempImage = document.createElement("div");
  if (roleAndPic && roleAndPic.profilePic) {
    tempImage.style.background = `url('${roleAndPic.profilePic}')`;
  } else {
    let nameInitials = document.createElement("h1");
    nameInitials.innerHTML = elementId.charAt(0).toUpperCase();
    nameInitials.className = "nameInitials";
    tempImage.style.background = "#00ffff";
    tempImage.appendChild(nameInitials);
  }
  tempImage.className = "tempImage";
  tempImage.style.display = "none";

  streamDiv.appendChild(tempImage);
  streamDiv.appendChild(streamName);
  streamDiv.innerHTML += optionsTemplate;
  options.streamVisibleCount++;

  let remoteContainer = document.getElementById(`remote-container`);
  remoteContainer.appendChild(streamDiv);
  updateClassName();
};

const toggleVideoAndThumbnail = (divId, userName, displayType) => {
  const targetUserStream = document.getElementById(divId);
  if (!targetUserStream) {
    setTimeout(() => {
      toggleVideoAndThumbnail(divId, userName, displayType);
    }, 2000);
  } else {
    let playerIDName = "";
    if (divId === "me") playerIDName = "player_undefined";
    else playerIDName = `player_${userName.split(" ")[0]}`;
    const targetUserVideoDiv = targetUserStream.querySelector(
      `#${playerIDName}`
    );
    const tempImageDiv = targetUserStream.querySelector(".tempImage");
    if (tempImageDiv && targetUserVideoDiv) {
      if (displayType === "thumbnail") {
        targetUserVideoDiv.style.display = "none";
        tempImageDiv.style.display = "flex";
      } else if (displayType === "video") {
        targetUserVideoDiv.style.display = "block";
        tempImageDiv.style.display = "none";
      }
    }
  }
};

const removeVideoStream = (elementId) => {
  let remoteDiv = document.getElementById(elementId);
  if (remoteDiv) {
    if (options.pinnedUser === elementId) {
      unPinVideo(elementId);
    }

    remoteDiv.parentNode.removeChild(remoteDiv);
    options.streamVisibleCount--;
    updateClassName();
  }
};

const updateClassName = () => {
  /*
  stremeElement - all

  stremeElement1 - 1 host
  stremeElement2 - 2 hosts
  stremeElement3plus - 3 plus hosts

  stremeElementPinned - video is pinned
  stremeElementSide - some other video is pinned

  screenStremeElement - screen shared video

  ALGO:
  stremeElement

  if some video is pinned:
    if current video is ponned:
      stremeElementPinned
    else:
      stremeElementSide
  else:
    host count === 1:
      stremeElement1
    host count === 2:
      stremeElement2
    host count >= 3:
      stremeElement3plus
      
  if current video is of a screen:
    screenStremeElement
  */

  const remoteContainer = document.getElementById("remote-container");
  const streams = remoteContainer.getElementsByClassName("stremeElement");
  let newClassName = "";
  for (let i = 0; i < streams.length; i++) {
    newClassName = "stremeElement";
    if (options.pinnedUser) {
      if (options.pinnedUser === streams[i].id)
        newClassName += " stremeElementPinned";
      else newClassName += " stremeElementSide";
    } else {
      if (options.streamVisibleCount === 1) newClassName += " stremeElement1";
      else if (options.streamVisibleCount === 2)
        newClassName += " stremeElement2";
      else if (options.streamVisibleCount >= 3)
        newClassName += " stremeElement3plus";
    }
    if (streams[i].id.includes("-Screen"))
      newClassName += " screenStremeElement";
    streams[i].className = newClassName;
  }
};

const togglePin = (targetStream) => {
  sendTogglePinUserMessage(targetStream);

  const targetStreamDiv = document.getElementById(targetStream);
  const isPinned = targetStreamDiv.classList.contains("stremeElementPinned");
  if (isPinned) unPinVideo(targetStream);
  else pinVideo(targetStream);
};

const togglePinFromMessage = (targetStream) => {
  if (targetStream === options.userName) targetStream = "me";
  const targetStreamDiv = document.getElementById(targetStream);
  const isPinned = targetStreamDiv.classList.contains("stremeElementPinned");
  if (isPinned) unPinVideo(targetStream);
  else pinVideo(targetStream);
};

const pinVideo = (targetStream) => {
  if (options.pinnedUser) {
    unPinVideo(options.pinnedUser);
  }
  options.pinnedUser = targetStream;

  const pinnedDiv = document.getElementById("pinned");
  pinnedDiv.style.display = "flex";
  const streams = document.getElementsByClassName("stremeElement");
  for (let i = 0; i < streams.length; i++) {
    streams[i].className = getClassName(
      streams[i].id,
      "stremeElement stremeElementSide"
    );
  }

  const targetStreamDiv = document.getElementById(targetStream);
  pinnedDiv.appendChild(targetStreamDiv);
  targetStreamDiv.className = getClassName(
    targetStream,
    "stremeElement stremeElementPinned"
  );
  targetStreamDiv.getElementsByTagName("li")[2].innerHTML = "Unpin";

  document.getElementById("remote-container").style.display = "block";
};

const unPinVideo = (targetStream) => {
  options.pinnedUser = null;
  rtm.client.addOrUpdateChannelAttributes(options.channel, {
    pinnedUser: "no-user-pinned",
  });
  const remoteContainer = document.getElementById("remote-container");
  const targetStreamDiv = document.getElementById(targetStream);
  targetStreamDiv.getElementsByTagName("li")[2].innerHTML = "Pin";
  remoteContainer.appendChild(targetStreamDiv);

  const pinnedDiv = document.getElementById("pinned");
  pinnedDiv.style.display = "none";
  updateClassName();
  document.getElementById("remote-container").style.display = "flex";
};

const getClassName = (streamName, classNames) => {
  if (streamName.includes("-Screen")) classNames += " screenStremeElement";
  return classNames;
};

const showOptions = (targetStream) => {
  const targetStreamDiv = document.getElementById(targetStream);
  const optionsDropDown =
    targetStreamDiv.getElementsByClassName("optionsDropdown");
  optionsDropDown[0].style.display = "block";
};

const showOptionsPeopleList = (peopleListID) => {
  const peopleListIDDiv = document.getElementById(`${peopleListID}-peoplList`);
  const optionsDropdownPeopleList = peopleListIDDiv.getElementsByClassName(
    "optionsDropdownPeopleList"
  );
  optionsDropdownPeopleList[0].style.display = "block";
};

// Close the dropdown if the user clicks outside of it
window.onclick = function (event) {
  if (
    !event.target.matches(".streamOptions") &&
    !event.target.matches(".peopleListOptions")
  ) {
    let dropdowns = document.getElementsByClassName("optionsDropdown");
    for (let i = 0; i < dropdowns.length; i++) {
      dropdowns[i].style.display = "none";
    }
    let dropdowns2 = document.getElementsByClassName(
      "optionsDropdownPeopleList"
    );
    for (let j = 0; j < dropdowns2.length; j++) {
      dropdowns2[j].style.display = "none";
    }
  }
};

// RTM

let rtm = {
  token: null,
  userName: null,
  client: null,
  channel: null,
  handRaisedList: [],
  userList: [],
};

const initializeRTMClient = () => {
  rtm.client = AgoraRTM.createInstance(options.appId);
  rtm.channel = rtm.client.createChannel(options.channel);

  rtm.client.on("ConnectionStateChanged", (newState, reason) => {
    console.log(
      "on connection state changed to " + newState + " reason: " + reason
    );
  });

  rtm.channel.on("ChannelMessage", ({ text }, senderId) => {
    const chatJson = JSON.parse(text);
    handleNewMessage(chatJson, senderId);
  });

  rtm.channel.on("MemberJoined", (memberId) => {
    setTimeout(() => {
      updatePeople();
    }, 1000);
  });
  rtm.channel.on("MemberLeft", (memberId) => {
    setTimeout(() => {
      updatePeople();
    }, 1000);
  });
};

const rtmClientLogin = async () => {
  await rtm.client.login({
    token: rtm.token,
    uid: options.userName.toString(),
  });
  await rtm.channel.join();
  options.isOriginalHost = await checkIfOriginalHost();
  let role = "audience";
  if (options.isOriginalHost) role = "host";
  else if (options.role == "host") role = "speaker";
  await rtm.client.addOrUpdateChannelAttributes(options.channel, {
    [options.userName]: JSON.stringify({
      role,
      profilePic: options.profilePic,
    }),
  });
  await updatePeople();
  if (options.role === "host") publishVideoStream();
  else stopLoader();
  setCallDuration();
  checkIfPinnedUserExist();
};

const checkIfOriginalHost = async () => {
  let rtmUsers = await rtm.channel.getMembers();
  if (rtmUsers.length === 1) {
    rtm.client.addOrUpdateChannelAttributes(options.channel, {
      originalStartTime: Date.now().toString(),
    });
    return true;
  } else return false;
};

const setCallDuration = async () => {
  if (!options.callStartTime) {
    const startTimeAttribute = await rtm.client.getChannelAttributesByKeys(
      options.channel,
      ["originalStartTime"]
    );
    options.callStartTime = startTimeAttribute.originalStartTime.value;
  }

  options.interval = setInterval(() => {
    const endTime = Date.now().toString();
    let resolution = endTime - options.callStartTime;
    const time = new Date(resolution).toISOString().substr(11, 8);
    document.getElementById("duration").innerText = time;
  }, 1000);
};

const checkIfPinnedUserExist = async () => {
  setTimeout(async () => {
    const channelAttr = await rtm.client.getChannelAttributesByKeys(
      options.channel,
      ["pinnedUser"]
    );
    if (channelAttr) {
      if (channelAttr.pinnedUser) {
        if (channelAttr.pinnedUser.value !== "no-user-pinned") {
          let toBePinned = channelAttr.pinnedUser.value;
          if (toBePinned === options.userName) toBePinned - options.userName;
          pinVideo(toBePinned);
        }
      }
    }
  }, 3000);
};

const handleNewMessage = (chatJson, senderId) => {
  switch (chatJson.messageType) {
    case "text":
      addChat(chatJson.text, senderId);
      break;
    case "raiseHand":
      raiseHand(senderId);
      break;
    case "lowerHand":
      lowerHand(senderId);
      break;
    case "pinUser":
      togglePinFromMessage(chatJson.userID);
      break;
    case "makeHost":
      if (chatJson.audienceID == options.userName)
        makeHost(chatJson.audienceID);
      break;
    case "makeAudience":
      if (chatJson.hostID === options.userName) makeAudience(chatJson.hostID);
      break;
    case "rejectHost":
      if (chatJson.audienceID == options.userName) sendLowerHandMessage();
      break;
    case "removeFromMeeting":
      if (chatJson.userID == options.userName)
        leaveCall("Removed from meeting");
      break;
    case "endCallForAll":
      leaveCall("Call ended");
      break;
    default:
      break;
  }
};

const addChat = async (msg, sender) => {
  let roleAndPic = getRoleAndPicFromName(sender);
  let picDiv = generateProfilePicOrInitials(sender, roleAndPic.profilePic);
  let template = `
  <div class="chatElement">
    <div class="peopleListDiv">
      ${picDiv}
      <span>${sender.replace(/_/g, " ")}</span>
    </div>
    <p>${msg}</p>
  </div>
  `;
  const chatArea = document.getElementById("chatArea");
  chatArea.innerHTML += template;
  chatArea.scrollTop = chatArea.scrollHeight;
};

const sendChannelMessage = async (event) => {
  event.preventDefault();
  const text = document.getElementById("inputText").value;
  if (text === "" || text === null || text === undefined) return;
  document.getElementById("inputText").value = "";
  addChat(text, options.userName);
  const chatJson = { messageType: "text", text };
  await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
};

const sendRaiseHandMessage = async () => {
  if (!rtm.handRaisedList.includes(options.userName)) {
    document.getElementById(
      "raiseHandBtn"
    ).className = `fas fa-hand-paper redAction`;
    rtm.handRaisedList.push(options.userName);
    let roleAndPic = getRoleAndPicFromName(options.userName);
    let newHandRaiseP = generateRaiseHandList(
      options.userName,
      roleAndPic.role,
      roleAndPic.profilePic
    );
    document.getElementById("handRaiseList").innerHTML += newHandRaiseP;
    options.raisedHandCounter++;
    document.getElementById(
      "raisedHandCounter"
    ).innerHTML = `(${options.raisedHandCounter})`;
    const chatJson = { messageType: "raiseHand" };
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
  } else {
    sendLowerHandMessage();
    document.getElementById("raiseHandBtn").className = `fas fa-hand-paper`;
  }
};

const sendLowerHandMessage = async () => {
  if (rtm.handRaisedList.includes(options.userName)) {
    const index = rtm.handRaisedList.indexOf(options.userName);
    rtm.handRaisedList.splice(index, 1);
    var elem = document.getElementById(`${options.userName}-hand`);
    elem.parentNode.removeChild(elem);
    options.raisedHandCounter--;
    document.getElementById(
      "raisedHandCounter"
    ).innerHTML = `(${options.raisedHandCounter})`;
    document.getElementById("raiseHandBtn").className = `fas fa-hand-paper`;
    const chatJson = { messageType: "lowerHand" };
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
  }
};

const sendMakeHostMessage = async (audienceID) => {
  const chatJson = { messageType: "makeHost", audienceID };
  await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
};

const sendMakeAudienceMessage = async (hostID) => {
  const chatJson = { messageType: "makeAudience", hostID };
  await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
};

const sendRejectHostMessage = async (audienceID) => {
  const chatJson = { messageType: "rejectHost", audienceID };
  await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
};

const sendRemoveMessage = async (userID) => {
  const chatJson = { messageType: "removeFromMeeting", userID };
  await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
};

const sendTogglePinUserMessage = async (userID) => {
  if (userID === "me") userID = options.userName;
  rtm.client.addOrUpdateChannelAttributes(options.channel, {
    pinnedUser: userID,
  });
  const chatJson = { messageType: "pinUser", userID };
  await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
};

const makeHost = async () => {
  await rtc.client.setClientRole("host");
  options.role = "host";
  toggleHostOnlyOptions("flex");
  sendLowerHandMessage();
};

const makeAudience = async () => {
  await rtc.client.setClientRole("audience");
  options.role = "audience";
  toggleHostOnlyOptions("none");
  document.getElementById("me").style.display = "none";
  var elem = document.getElementById("player_undefined");
  elem.parentNode.removeChild(elem);
};

const raiseHand = async (senderId) => {
  if (!rtm.handRaisedList.includes(senderId)) {
    rtm.handRaisedList.push(senderId);
    let roleAndPic = getRoleAndPicFromName(senderId);
    let newHandRaiseP = generateRaiseHandList(
      senderId,
      roleAndPic.role,
      roleAndPic.profilePic
    );
    document.getElementById("handRaiseList").innerHTML += newHandRaiseP;
    options.raisedHandCounter++;
    document.getElementById(
      "raisedHandCounter"
    ).innerHTML = `(${options.raisedHandCounter})`;
  }
};

const lowerHand = (senderId) => {
  if (rtm.handRaisedList.includes(senderId)) {
    const index = rtm.handRaisedList.indexOf(senderId);
    rtm.handRaisedList.splice(index, 1);
    var elem = document.getElementById(`${senderId}-hand`);
    elem.parentNode.removeChild(elem);
    options.raisedHandCounter--;
    document.getElementById(
      "raisedHandCounter"
    ).innerHTML = `(${options.raisedHandCounter})`;
  }
};

const generatePeopleList = (name, role, profilePic) => {
  let displayValue = "none";
  if (options.role === "host" && name != options.userName)
    displayValue = "block";

  let picDiv = generateProfilePicOrInitials(name, profilePic);

  // let template = `
  // <div class="userItem">
  //   <div class="peopleListDiv">
  //     ${picDiv}
  //     <span>${name.replace(/_/g, " ")} (${role})</span>
  //   </div>
  //   <button onclick="sendMakeHostMessage('${name}')" style="display: ${displayValue}" >Make Host</button>
  //   <button onclick="sendRemoveMessage('${name}')" style="display: ${displayValue}" >Remove</button>
  // </div>
  // `;

  let template = `
  <div class="userItem" id="${name}-peoplList" >
    <div class="peopleListDiv">
      ${picDiv}
      <span>${name.replace(/_/g, " ")} (${role})</span>
    </div>
    <i class="fas fa-ellipsis-v peopleListOptions" onclick="showOptionsPeopleList('${name}')" style="display: ${displayValue}"></i>
    <ul class="optionsDropdownPeopleList" style="display: none">
      <li onclick="sendMakeHostMessage('${name}')">Make Host</li>
      <li onclick="sendRemoveMessage('${name}')">Remove</li>
    </ul>
  </div>
  `;

  return template;
};

const generateRaiseHandList = (name, role, profilePic) => {
  let displayValue = "none";
  if (options.role === "host" && role === "audience") displayValue = "block";

  let picDiv = generateProfilePicOrInitials(name, profilePic);

  let template = `
  <div class="userItem" id="${name}-hand">
    <div class="peopleListDiv">
      ${picDiv}
      <span>${name.replace(/_/g, " ")} (${role})</span>
    </div>
    <button onclick="sendMakeHostMessage('${name}')" style="display: ${displayValue}" >Make Host</button>
    <button onclick="sendRejectHostMessage('${name}')" style="display: ${displayValue}" >Reject</button>
  </div>
  `;
  return template;
};

const generateProfilePicOrInitials = (name, profilePic) => {
  let picDiv = "";
  if (profilePic) {
    picDiv = `
    <div class="peopleListImage" style="background: url('${profilePic}')">
    </div>
    `;
  } else {
    picDiv = `
    <div class="peopleListImage" style="background: #00ffff" >
      <h1>${name.charAt(0).toUpperCase()}</h1>
    </div>
    `;
  }
  return picDiv;
};

const getRoleAndPicFromName = (name) => {
  let roleAndPic = rtm.userList.find((user) => user.userName === name);
  return roleAndPic;
};

const updatePeople = async () => {
  let channelAttributes = await rtm.client.getChannelAttributes(
    options.channel
  );
  let rtmUsers = await rtm.channel.getMembers();
  let tempArray = Object.keys(channelAttributes);
  let finalOnlineUsers = tempArray.filter((user) => rtmUsers.includes(user));
  document.getElementById("userCount").innerText = finalOnlineUsers.length;
  rtm.userList = [];
  finalOnlineUsers.forEach((user) => {
    const userRoleAndPic = JSON.parse(channelAttributes[user].value);
    rtm.userList.push({
      userName: user,
      role: userRoleAndPic.role,
      profilePic: userRoleAndPic.profilePic,
    });
  });
  document.getElementById("peopleListGroup").innerHTML = "";
  rtm.userList.forEach((user) => {
    document.getElementById("peopleListGroup").innerHTML += generatePeopleList(
      user.userName,
      user.role,
      user.profilePic
    );
  });
};

const searchForPeople = (e) => {
  const searchTerm = e.target.value;
  document.getElementById("peopleListGroup").innerHTML = "";
  rtm.userList.forEach((user) => {
    const formattedUserName = user.userName.toLowerCase();
    const formattedSearchTerm = searchTerm.toLowerCase().replace(/ /g, "_");
    if (formattedUserName.includes(formattedSearchTerm)) {
      document.getElementById("peopleListGroup").innerHTML +=
        generatePeopleList(user.userName, user.role, user.profilePic);
    }
  });
};

const changeLayout = (toKeep) => {
  document.getElementById("chatArea").style.display = "none";
  document.getElementById("peopleList").style.display = "none";
  document.getElementById("handRaiseList").style.display = "none";
  document.getElementsByClassName("chatInput")[0].style.display = "none";
  document.getElementById(toKeep).style.display = "block";
  if (toKeep === "chatArea") {
    document.getElementsByClassName("chatInput")[0].style.display = "block";
  }
};

const toggleHostOnlyOptions = (displayType) => {
  document.getElementById("videoBtnDiv").style.display = displayType;
  document.getElementById("audioBtnDiv").style.display = displayType;
  document.getElementById("screenBtnDiv").style.display = displayType;
  document.getElementById("endSession").style.display = "none";
  changeLayout("chatArea");
  document.getElementById("raiseHandListBtn").style.display = displayType;
  const group1 = document.getElementsByClassName("streamOptions");
  for (let i = 0; i < group1.length; i++) group1[i].style.display = displayType;

  const peopleList = document.getElementById("peopleList");
  const group2 = peopleList.getElementsByTagName("button");
  for (let j = 0; j < group2.length; j++) group2[j].style.display = displayType;
};

const endCallForAll = async () => {
  const confirmation = confirm(
    "Are you sure you want to end the call for everyone?"
  );
  if (confirmation) {
    const chatJson = { messageType: "endCallForAll" };
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
    leaveCall("Call ended");
  }
};

const startLoader = () => {
  options.initialLoading = true;
  document.getElementsByClassName("videos")[0].style.display = "none";
  document.getElementsByClassName("loader")[0].style.display = "flex";
  if (document.getElementsByClassName("chat")[0]) {
    document.getElementsByClassName("chat")[0].style.display = "none";
  }
};

const stopLoader = () => {
  options.initialLoading = false;
  document.getElementsByClassName("videos")[0].style.display = "flex";
  document.getElementsByClassName("loader")[0].style.display = "none";
  if (document.getElementsByClassName("chat")[0]) {
    document.getElementsByClassName("chat")[0].style.display = "flex";
  }
};

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/* Popup Script */

let CHAT_POPUP_STATUS = false;

const toggleChatPopup = () => {
  if (CHAT_POPUP_STATUS) {
    document.getElementsByClassName("chatPopup")[0].style.display = "none";
  } else {
    document.getElementsByClassName("chatPopup")[0].style.display = "flex";
  }
  CHAT_POPUP_STATUS = !CHAT_POPUP_STATUS;
};

/* Mobile Script */

const toggleMobileChat = () => {
  document.getElementsByClassName("chat")[0].classList.toggle("active");
  document.getElementById("mobileOptions").classList.toggle("active");
};

/*
Replace this 

const joinCall = async (userName, role, profilePic,session) => {
  options.role = role;
  options.userName = userName;
  options.profilePic = profilePic;

  if(session){
      options.channel = session;
  } else {
      var url = new URL(window.location.href);
      options.channel = url.searchParams.get("session");
  }

  if (!options.channel) {
    options.channel = "demo_channel_name";
  }
  if (!options.userName) {
    options.userName = prompt("Enter username", "");
  }
  if (!options.role) {
    options.role = "host";
  }

  let agoraDiv = document.getElementsByClassName("agora-div")[0];
  let bubbleDiv = agoraDiv.parentElement;
  bubbleDiv.style.height = "calc(100vh - 65px)";
  bubbleDiv.parentElement.style.height = "calc(100vh - 65px)";
  bubbleDiv.parentElement.parentElement.style.height = "calc(100vh - 65px)";
}
*/
