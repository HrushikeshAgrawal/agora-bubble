const expand = () => {
    document.getElementsByClassName("agora-div")[0].classList.toggle("chat-dis");
    document.getElementsByClassName("chatInputDiv")[0].style.display = "none";
    document.getElementsByClassName("chatArea")[0].style.display = "none";
    document.getElementById("peopleList").style.display = "none";
}
const fullScreen = () => {
    document.getElementsByClassName("videosLayout")[0].classList.toggle("whole-screen");
    document.getElementsByClassName("agora-div")[0].style.position = "absolute"
}


let options = {
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
    initializeRTCClient();
    joinCall();
    // stopLoader();
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
// setInterval(function (evt) {
//     var audioLevel = evt.stream.getAudioLevel();
//     console.log(audioLevel);
// }, 100)

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

const joinCall = async () => {
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


const closeModal = (id) => {
    if (id === 'myModal') document.getElementById("modalContent").innerHTML = "";
    document.getElementById(id).style.display = "none"
}

const openPollModal = () => {
    document.getElementById("poll-modal").style.display = "block";
}

const toggleAudio = async () => {
    if (LOCAL_AUDIO_STREAM) {
        rtc.videoStream.muteAudio();
        const index = rtm.unmuteList.indexOf(options.userName);
        rtm.unmuteList.splice(index, 1);
        console.log(rtm.unmuteList);
    }
    else {
        rtc.videoStream.unmuteAudio();
        rtm.unmuteList.push(options.userName);
        console.log(rtm.unmuteList);
    };
    LOCAL_AUDIO_STREAM = !LOCAL_AUDIO_STREAM;
    const chatJson = { messageType: 'unmute' }
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
    renameBtns();
    updatePeople();
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
      <li onclick="sendMakeAudienceMessage('${elementId}')">Make Audience</li>
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
      <li onclick="sendMakeAudienceMessage('${elementId}')">Make Audience</li>
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
        // tempImage.style.background = `${"#" + ((1 << 24) * Math.random() | 0).toString(16)}`;
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
    unmuteList: []
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
        document.getElementById("duration").innerHTML = `<i class="fas fa-circle"></i> ${time}`;
        document.getElementById("top-duration").innerText = time;
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
        case "unmute":
            unmuteAction(senderId);
            break;
        case "addToPoll":
            addToPoll(chatJson.text);
            break;
        case "upVote":
            upVote(chatJson.text, chatJson.id, senderId);
            break;
        case "reply":
            addReply(chatJson.id, chatJson.text);
            break;
        case "qna":
            addQnA(chatJson.text, chatJson.qnaSender);
            break;
        case "pollSelected":
            sendSelected(chatJson.options, senderId);
            break;
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


pollList = [];
const createPoll = () => {
    let modal = document.getElementById("myModal");
    let modalContent = document.getElementById("modalContent");
    modal.style.display = "block";
    modalContent.innerHTML = "";

    pollList.map(each => {
        let template = `
      <div class="eachPoll" >
      <div class="pollNoDiv" ><h6>Poll ${each.id}</h6></div>
      <div class="pollQuesDiv" ><p>${each.ques}</p></div>
      <div class="pollVotersDiv" ><p>Votes ${each.voters}</p></div>
      <div class="pollFooterDiv" >
        <div> <button>Publish results</button> </div>
        <div> 
          <i class="fas fa-lock"></i>
          <i title="Launch" onclick="sendChannelMessage(event,true,null)" id="${each.id}" class="fas fa-play-circle"></i>
          <i class="fas fa-stop"></i>
        </div>
      </div>
      </div>
      `
        modalContent.innerHTML += template;
    })

}
let pollId = 0
const saveNewPoll = async (event) => {
    event.preventDefault();
    pollId++;

    const newPoll = {
        id: pollId,
        ques: document.getElementById('quesInp').value,
        option1: document.getElementById('ansInp1').value,
        option2: document.getElementById('ansInp2').value,
        option3: document.getElementById('ansInp3').value,
        option4: document.getElementById('ansInp4').value,
        option5: document.getElementById('ansInp5').value,
        voters: [],
        option1Voters: [],
        option2Voters: [],
        option3Voters: [],
        option4Voters: [],
        option5Voters: []
    }

    addToPoll(newPoll)
    const chatJson = { messageType: "addToPoll", text: newPoll }
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });

    createPoll(pollList);

    document.getElementById('quesInp').value = ""
    document.getElementById('ansInp1').value = ""
    document.getElementById('ansInp2').value = ""
    document.getElementById('ansInp3').value = ""
    document.getElementById('ansInp4').value = ""
    document.getElementById('ansInp5').value = ""
    document.getElementById("poll-modal").style.display = "none";
}

const addToPoll = (newPoll) => {
    pollList.push(newPoll)
}

const masterQnAList = [];
let id = 0;
const addQnA = async (msg, sender) => {
    const QnAList = []
    id++;
    let picDiv = ""
    if (sender === "Anonymous") {
        picDiv = generateProfilePicOrInitials(sender);
    }
    else {
        let roleAndPic = getRoleAndPicFromName(sender);
        picDiv = generateProfilePicOrInitials(sender, roleAndPic.profilePic);
    }


    QnAObject = { id: id, msg: msg, isAnswered: true, upVoter: [] }
    QnAList.push(QnAObject)
    masterQnAList.push(QnAObject)


    QnAList.map(each => {
        let template = `
      <div id="${'singleQues' + each.id}" >
    <div class="chatElement qnaElement">
        <div>
          <div class="peopleListDiv">
            ${picDiv}
            <span class="qnaSender" >${sender.replace(/_/g, " ")}</span>
          </div>
          <div class="qnaQues" >
            <p>${each.msg}</p>
          </div>
          <div class="replyDiv" id="${'replyDiv' + each.id}" style="display:none" >
          <small id="${'reply' + each.id}" ></small>
        </div>
        <div id="${each.id}" class="qnaReply" >
          <textarea name="" id="${'replyMsg' + each.id}" cols="30" rows="3"></textarea>
          <button onclick="sendReplyMessage('${each.id}')" > Reply </button>
        </div>
        </div>
        
    </div>
      <div class="chatElement qnaElement">
        
      </div>
      <div class="qnaIcon" >
          <i onclick="sendUpVoteMessage('${each.id}')" class="fas fa-thumbs-up" style="user-select:none" >  <span id="${'upVote' + each.id}" style="color:black" >${QnAObject.upVoter.length}</span> </i>
          <i id="${'replied' + each.id}" style="display:none" class="fas fa-check-circle"></i>
          <i onclick="sendReplyMessage('${each.id}')" style="display: ${options.role === 'host' ? 'inline' : 'none'} " class="fas fa-arrow-up"></i>
          <i onclick="openReply('${each.id}')" style="display: ${options.role === 'host' ? 'inline' : 'none'}"  title="Reply" class="fas fa-reply"></i>
        </div>
  </div>
      `;
        const qnaArea = document.getElementById("qnaArea");
        qnaArea.innerHTML += template;
        qnaArea.scrollTop = qnaArea.scrollHeight;
    })

}

const openReply = (id) => {
    document.getElementById(`${id}`).style.display = "block"
}

const upVote = (element, id, senderId) => {
    if (!QnAObject.upVoter.includes(senderId)) {
        QnAObject.upVoter.push(senderId);
    }
    let newElement = QnAObject.upVoter.length;
    document.getElementById(`${"upVote" + id}`).innerText = newElement;
}

const sendUpVoteMessage = async (id) => {
    if (!QnAObject.upVoter.includes(options.userName)) {
        QnAObject.upVoter.push(options.userName);
    }
    let element = QnAObject.upVoter.length;
    document.getElementById(`${"upVote" + id}`).innerText = element;
    const chatJson = { messageType: "upVote", text: element, id: id };
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
}

const sendReplyMessage = async (id) => {
    const text = document.getElementById(`${'replyMsg' + id}`).value;
    addReply(id, text);
    const chatJson = { messageType: "reply", text: text, id: id };
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
}

const addReply = (id, replyMsg) => {
    const replyBox = document.getElementById(`${id}`);
    replyBox ? replyBox.style.display = "none" : "";
    document.getElementById(`${'replyDiv' + id}`).style.display = "block";
    document.getElementById(`${'replied' + id}`).style.display = "inline";
    document.getElementById(`${'singleQues' + id}`).className = "qnaSingleDiv"
    const replyDiv = document.getElementById(`${'reply' + id}`);
    replyDiv.innerHTML = replyMsg;
}

const addChat = async (msg, sender) => {
    console.log(sender);

    let roleAndPic = getRoleAndPicFromName(sender);
    let picDiv = generateProfilePicOrInitials(sender, roleAndPic.profilePic);


    let template = ``;
    if (msg instanceof Object) {

        const options = [];
        if (msg.option1) options.push(msg.option1)
        if (msg.option2) options.push(msg.option2)
        if (msg.option3) options.push(msg.option3)
        if (msg.option4) options.push(msg.option4)
        if (msg.option5) options.push(msg.option5)
        let optionsTemplate = "";
        options.map((each, index) => {
            index++;
            let singleOption = `<p class="pollOptions" id="${msg.id + 'option' + index}" onclick="selectOption(event)" >${index}. ${each} <span id="${msg.id + 'result' + index}" ></span> </p> `;
            optionsTemplate += singleOption;
        })
        template = `
        <div class="chatElement">
          <div class="peopleListDiv">
            ${picDiv}
            <span>${sender.replace(/_/g, " ")}</span>
          </div>
          <h4>${msg.ques}</h4>  
          ${optionsTemplate}
        </div>
        `;
    }

    else {
        template = `
      <div class="chatElement">
        <div class="peopleListDiv">
          ${picDiv}
          <span>${sender.replace(/_/g, " ")}</span>
        </div>
        <p>${msg}</p>
      </div>
      `;
    }

    const chatArea = document.getElementById("chatArea");
    chatArea.innerHTML += template;
    chatArea.scrollTop = chatArea.scrollHeight;

};

const selectOption = async (event) => {
    const selectedOption = event.target.id;

    sendSelected(selectedOption, options.userName)
    const chatJson = { messageType: "pollSelected", options: selectedOption }
    await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });

}

const sendSelected = async (selectedOption, senderId) => {

    const pollId = selectedOption.slice(0, 1);
    const optionId = selectedOption.slice(1);
    const selectedPoll = pollList[pollId - 1];
    if (!selectedPoll[`${optionId + 'Voters'}`].includes(senderId)) {
        selectedPoll[`${optionId + 'Voters'}`].push(senderId);
    }

    console.log(selectedPoll);

    const { option1Voters, option2Voters, option3Voters, option4Voters, option5Voters } = selectedPoll
    const totalSelection = option1Voters.length + option2Voters.length + option3Voters.length + option4Voters.length + option5Voters.length;

    let option1Per = Math.round((100 * option1Voters.length) / totalSelection) + "%";
    let option2Per = Math.round((100 * option2Voters.length) / totalSelection) + "%";
    let option3Per = Math.round((100 * option3Voters.length) / totalSelection) + "%";
    let option4Per = Math.round((100 * option4Voters.length) / totalSelection) + "%";
    let option5Per = Math.round((100 * option5Voters.length) / totalSelection) + "%";
    document.getElementById(`${pollId + "result1"}`).innerText = option1Per;
    document.getElementById(`${pollId + "result2"}`).innerText = option2Per;
    document.getElementById(`${pollId + "result3"}`).innerText = option3Per;
    document.getElementById(`${pollId + "result4"}`).innerText = option4Per;
    document.getElementById(`${pollId + "result5"}`).innerText = option5Per;
}

const sendChannelMessage = async (event, isPoll, qna) => {
    document.getElementById("myModal").style.display = "none";
    event.preventDefault();
    if (isPoll) {

        const poll = pollList.find(each => each.id == event.target.id)
        const text = poll;
        addChat(text, options.userName, false);
        const chatJson = { messageType: "text", text }
        await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
    }
    else {
        if (qna) {
            const text = document.getElementById("qnaInputText").value;
            if (text === "" || text === null || text === undefined) return;
            document.getElementById("qnaInputText").value = "";
            const askAnonymous = document.getElementById("qnaCheck").checked;
            const qnaSender = askAnonymous ? "Anonymous" : options.userName
            addQnA(text, qnaSender);
            const chatJson = { messageType: "qna", text, qnaSender };
            await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
        }
        else {
            const text = document.getElementById("inputText").value;
            if (text === "" || text === null || text === undefined) return;
            document.getElementById("inputText").value = "";
            addChat(text, options.userName, false);
            const chatJson = { messageType: "text", text };
            await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
        }
    }
};

const sendRaiseHandMessage = async () => {
    if (!rtm.handRaisedList.includes(options.userName)) {
        document.getElementById('raiseHandBtn').className = 'fas fa-hand-paper redAction';
        rtm.handRaisedList.push(options.userName);
        console.log(rtm.handRaisedList);
        // let roleAndPic = getRoleAndPicFromName(options.userName)
        // let newHandRaiseP = generateRaiseHandList(options.userName, roleAndPic.role, roleAndPic.profilePic);
        // document.getElementById('handRaiseList').innerHTML += newHandRaiseP;
        // options.raisedHandCounter++;
        // document.getElementById('raisedHandCounter').innerHTML = `(${options.raisedHandCounter})`
        updatePeople();
        const chatJson = { messageType: 'raiseHand' }
        await rtm.channel.sendMessage({ text: JSON.stringify(chatJson) });
    }
    else {
        sendLowerHandMessage();
        document.getElementById('raiseHandBtn').className = 'fas fa-hand-paper';
    }
};

const sendLowerHandMessage = async () => {
    if (rtm.handRaisedList.includes(options.userName)) {
        const index = rtm.handRaisedList.indexOf(options.userName);
        rtm.handRaisedList.splice(index, 1);
        console.log(rtm.handRaisedList);
        updatePeople();
        // var elem = document.getElementById(`${options.userName}-hand`);
        // elem.parentNode.removeChild(elem);
        // options.raisedHandCounter--;
        // document.getElementById(
        //     "raisedHandCounter"
        // ).innerHTML = `(${options.raisedHandCounter})`;
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

const unmuteAction = async (senderId) => {
    if (!rtm.unmuteList.includes(senderId)) {
        rtm.unmuteList.push(senderId);
        updatePeople();
    }
    else {
        const index = rtm.unmuteList.indexOf(senderId);
        rtm.unmuteList.splice(index, 1);
        updatePeople();
    }
}

const raiseHand = async (senderId) => {
    if (!rtm.handRaisedList.includes(senderId)) {
        rtm.handRaisedList.push(senderId);
        updatePeople();
        // let roleAndPic = getRoleAndPicFromName(senderId);
        // let newHandRaiseP = generateRaiseHandList(
        //     senderId,
        //     roleAndPic.role,
        //     roleAndPic.profilePic
        // );
        // document.getElementById("handRaiseList").innerHTML += newHandRaiseP;
        // options.raisedHandCounter++;
        // document.getElementById(
        //     "raisedHandCounter"
        // ).innerHTML = `(${options.raisedHandCounter})`;
    }
};

const lowerHand = (senderId) => {
    if (rtm.handRaisedList.includes(senderId)) {
        const index = rtm.handRaisedList.indexOf(senderId);
        rtm.handRaisedList.splice(index, 1);
        updatePeople();
        // var elem = document.getElementById(`${senderId}-hand`);
        // elem.parentNode.removeChild(elem);
        // options.raisedHandCounter--;
        // document.getElementById(
        //     "raisedHandCounter"
        // ).innerHTML = `(${options.raisedHandCounter})`;
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
        <span>${name.replace(/_/g, " ")}</span>
      </div>
      <div class="userListInfo" >
      <img style="display: ${rtm.handRaisedList.includes(name) ? 'block' : 'none'} " src="./icons/palm-of-hand 1.svg" alt="" />
      <img style="display: ${!rtm.unmuteList.includes(name) ? 'block' : 'none'} " src="./icons/mute.svg" alt="" />
      <img style="display: ${rtm.unmuteList.includes(name) ? 'block' : 'none'} " src="./icons/unmute.svg" alt="" />
      <i class="fas fa-ellipsis-v peopleListOptions" onclick="showOptionsPeopleList('${name}')" style="display: ${displayValue}"></i>
      <ul class="optionsDropdownPeopleList" style="display: none">
        <li onclick="sendMakeHostMessage('${name}')">Make Host</li>
        <li onclick="sendRemoveMessage('${name}')">Remove</li>
      </ul>
      </div>
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
    if (name === "Anonymous") {
        picDiv = `
      <div class="peopleListImage">
      <img src="https://www.pngfind.com/pngs/m/610-6104451_image-placeholder-png-user-profile-placeholder-image-png.png" alt="" />
      </div>
      `;
    }
    else if (profilePic) {
        picDiv = `
      <div class="peopleListImage" style="background: url('${profilePic}')">
      </div>
      `;
    } else {
        picDiv = `
      <div class="peopleListImage" style="background: ${"#" + ((1 << 24) * Math.random() | 0).toString(16)}" >
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
    // document.getElementById("userCount").innerText = finalOnlineUsers.length;
    rtm.userList = [];
    finalOnlineUsers.forEach((user) => {
        const userRoleAndPic = JSON.parse(channelAttributes[user].value);
        rtm.userList.push({
            userName: user,
            role: userRoleAndPic.role,
            profilePic: userRoleAndPic.profilePic,
        });
    });
    // document.getElementById("peopleListGroup").innerHTML = "";
    document.getElementById("peopleListGroupHost").innerHTML = "";
    document.getElementById("peopleListGroupSpeaker").innerHTML = "";
    document.getElementById("peopleListGroupAudience").innerHTML = "";

    rtm.userList.forEach((user) => {
        // document.getElementById("peopleListGroup").innerHTML += generatePeopleList(
        //     user.userName,
        //     user.role,
        //     user.profilePic
        // );
        if (user.role === 'host') {
            document.getElementById("peopleListGroupHost").innerHTML += generatePeopleList(
                user.userName,
                user.role,
                user.profilePic
            );
        }
        if (user.role === 'speaker') {
            document.getElementById("peopleListGroupSpeaker").innerHTML += generatePeopleList(
                user.userName,
                user.role,
                user.profilePic
            );
        }
        if (user.role === 'audience') {
            document.getElementById("peopleListGroupAudience").innerHTML += generatePeopleList(
                user.userName,
                user.role,
                user.profilePic
            );
        }
    });
};

const hideList = (list) => {
    document.getElementById(`${'peopleListGroup' + list}`).classList.toggle('peopleListHide');
}

const searchForPeople = (e) => {
    const searchTerm = e.target.value;
    // document.getElementById("peopleListGroup").innerHTML = "";
    document.getElementById("peopleListGroupHost").innerHTML = "";
    document.getElementById("peopleListGroupSpeaker").innerHTML = "";
    document.getElementById("peopleListGroupAudience").innerHTML = "";
    rtm.userList.forEach((user) => {
        const formattedUserName = user.userName.toLowerCase();
        const formattedSearchTerm = searchTerm.toLowerCase().replace(/ /g, "_");
        if (formattedUserName.includes(formattedSearchTerm)) {
            // document.getElementById("peopleListGroup").innerHTML +=
            //     generatePeopleList(user.userName, user.role, user.profilePic);
            if (user.role === 'host') {
                document.getElementById("peopleListGroupHost").innerHTML +=
                    generatePeopleList(user.userName, user.role, user.profilePic);
            }
            if (user.role === 'speaker') {
                document.getElementById("peopleListGroupSpeaker").innerHTML +=
                    generatePeopleList(user.userName, user.role, user.profilePic);
            }
            if (user.role === 'audience') {
                document.getElementById("peopleListGroupAudience").innerHTML +=
                    generatePeopleList(user.userName, user.role, user.profilePic);
            }
        }
    });
};

const changeLayout = (toKeep) => {
    document.getElementsByClassName("agora-div")[0].classList.remove("chat-dis");
    document.getElementById("chatArea").style.display = "none";
    document.getElementById("peopleList").style.display = "none";
    document.getElementById("handRaiseList").style.display = "none";
    document.getElementById("qnaArea").style.display = "none";
    document.getElementsByClassName("chatInput")[0].style.display = "none";
    document.getElementsByClassName("qnaInput")[0].style.display = "none";
    document.getElementById(toKeep).style.display = "block";
    if (toKeep === "chatArea") {
        document.getElementsByClassName("chatInput")[0].style.display = "block";
        document.getElementsByClassName("chatInputDiv")[0].style.display = "block";
        document.getElementsByClassName("chatArea")[0].style.display = "block";
    }
    if (toKeep === "qnaArea") {
        document.getElementsByClassName("qnaInput")[0].style.display = "block";
        document.getElementsByClassName("chatArea")[0].style.display = "block";
    }
};

const toggleHostOnlyOptions = (displayType) => {
    document.getElementById("videoBtnDiv").style.display = displayType;
    document.getElementById("audioBtnDiv").style.display = displayType;
    document.getElementById("screenBtnDiv").style.display = displayType;
    document.getElementById("pollBtnDiv").style.display = displayType;
    document.getElementById("endSession").style.display = "none";
    changeLayout("chatArea");
    // document.getElementById("raiseHandListBtn").style.display = displayType;
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
