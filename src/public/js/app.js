const socket = io();    // io는 자동적으로  back-end socket.io와 연결해주는 function

const myFace = document.getElementById("myFace");   
const muteBtn = document.getElementById("mute");        
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
    try{
        const devices = await navigator.mediaDevices.enumerateDevices(); // 모든 media devices를 가져옴
        const cameras = devices.filter((device) => device.kind === "videoinput"); // videoinput인 것만 가져옴
        const currentCamera = myStream.getVideoTracks()[0]; // 현재 video track을 가져옴
        cameras.forEach((camera) => {
            const option = document.createElement("option"); // option을 만들어서
            option.value = camera.deviceId; // value에 camera의 deviceId를 넣고
            option.innerText = camera.label; // text에 camera의 label을 넣음
            if(currentCamera.label === camera.label) { // 만약 현재 camera의 label과 camera의 label이 같으면
                option.selected = true; // option을 선택함
            }
            camerasSelect.appendChild(option); // cameraSelect에 option을 넣음
        });
    }catch(e){
        console.log(e)
    }
}

async function getMedia(deviceId) {
    const initialConstrains = {                //deviceId가 없으면 
        audio: true,
        video: { facingMode: "user" }
    };
    const cameraConstraints = {                //deviceId가 있으면
        audio: true, 
        video: { deviceId: { exact: deviceId } }
    };
    try {
        myStream = await navigator.mediaDevices.getUserMedia(  // audio, video를 가져옴
            deviceId ? cameraConstraints : initialConstrains
        );
        myFace.srcObject = myStream;
        if(!deviceId) {
            await getCameras();
        }
        
    } catch(e) {
        console.log(e);
    }
}

function handleMuteClick() {
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled)); // 모든 audio track을 가져와서 enabled를 반대로 바꿈
    if(!muted) {
        muteBtn.innerText = "Unmute";
        muted = true;
    } else {
        muteBtn.innerText = "Mute";
        muted = false;
    }
}
function handleCameraClick() {
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled)); // 모든 video track을 가져와서 enabled를 반대로 바꿈
    if(cameraOff) {
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange(){
    await getMedia(camerasSelect.value);
    if(myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0]; // video track을 가져옴
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video"); // video track을 찾음
        videoSender.replaceTrack(videoTrack); // video track을 바꿈, sender는 다른 브라우저로 보내진 비디오와 오디오 데이터를 컨트롤하는 방법
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange); // cameraSelect의 input이 바뀌면 handleCameraChange를 실행


// Welcome Form (join a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value); // input의 value를 server로 보냄
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

//Socket Code

socket.on("welcome", async() => {                       // (peer A) server에서 welcome event를 받으면
    myDataChannel = myPeerConnection.createDataChannel("chat"); // data channel을 만듦
    myDataChannel.addEventListener("message", (event) => console.log(event.data)); // data channel에서 message event가 발생하면 event의 data를 출력
    console.log("made data channel");
    const offer = await myPeerConnection.createOffer();  // offer를 만듦
    myPeerConnection.setLocalDescription(offer);   // offer를 local description으로 설정
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);         // offer를 server로 보냄
});

socket.on("offer", async(offer) => {               // (peer B) server에서 offer event를 받으면
    myPeerConnection.addEventListener("datachannel", (event) => { // peerConnection에서 datachannel event가 발생하면
        myDataChannel = event.channel; // myDataChannel을 event의 channel로 설정
        myDataChannel.addEventListener("message", (event) => console.log(event.data)); // myDataChannel에서 message event가 발생하면 event의 data를 출력
    });
    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer);  // offer를 remote description으로 설정
    const answer = await myPeerConnection.createAnswer(); // answer를 만듦
    myPeerConnection.setLocalDescription(answer);  // answer를 local description으로 설정
    socket.emit("answer", answer, roomName);       // answer를 server로 보냄
    console.log("sent the answer");
})

socket.on("answer", answer => {                    // (peer A) server에서 answer event를 받으면
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer); // answer를 remote description으로 설정
})

socket.on("ice", ice => {                  
    console.log("recive candidate")                
    myPeerConnection.addIceCandidate(ice);         
});

//RTC Code
function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
              urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
              ],
            },
          ],
    });
    myPeerConnection.addEventListener("icecandidate", handleIce); // peerConnection에서 icecandidate event가 발생하면 handleIce를 실행
    myPeerConnection.addEventListener("addstream", handleAddStream); // peerConnection에서 addstream event가 발생하면 handleAddStream을 실행
    myStream
        .getTracks()
        .forEach((track) => myPeerConnection.addTrack(track, myStream)); // myStream의 모든 track을 peerConnection에 추가
}

function handleIce(data) {
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName); // data의 candidate를 server로 보냄
}

function handleAddStream(data) {
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream; // peerFace의 srcObject를 data의 stream으로 설정
}