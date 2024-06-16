const userdata = {}
const cooling = {}
const target_img = {}
const target_img_loc = {}
const run = {}
const video = document.createElement("video")
const img = document.createElement("img")
img.crossOrigin = "anonymous"
//document.body.appendChild(video)

let stream_url = localStorage.getItem("stream_url")
let input_url = localStorage.getItem("input_url")
let fps = localStorage.getItem("fps")
if (fps === null) {
    console.log("FPS를 기본값 10으로 적용합니다.")
    fps = 10
} else {
    console.log(`FPS를 ${fps}로 적용합니다.`)
}
let writer;
let input_type = ""
const encoder = new TextEncoder();

const set_fps = () => {
    const value = prompt("설정할 fps값을 입력하세요.", String(fps))
    fps = parseInt(value)
    localStorage.setItem("fps", fps)
    console.log(`FPS를 ${fps}로 적용합니다.`)
}

const cool_run = (key) => {
    cooling[key] = true
    setTimeout(() => { cooling[key] = false }, userdata[key].cooltime * 1000)
}

const send_keys = async (data) => {
    const keys = data.key
    const token = data.tele_token
    const chat_id = data.tele_room
    for (key of keys.split(" ")) {
        if (key == "cap") {
            download_img()
        } else if (key.indexOf("noti") >= 0) {
            const argument = key.slice(key.indexOf("(") + 1, key.indexOf(")"))
            telegram_message(token, chat_id, argument)
        } else if (key.indexOf("photo") >= 0) {
            const argument = key.slice(key.indexOf("(") + 1, key.indexOf(")"))
            telegram_photo(token, chat_id, argument, "viewer")
        } else if (key.indexOf("-") >= 0) {
            const argument = key.slice(1, key.length)
            await delay(argument * 1000)
        } else if (data.type == "imgslot" && key == "click") {
            const click_command = `${target_img_loc[data.name][0]},${target_img_loc[data.name][1]}`
            if (input_type == "url") {
                fetch(`${input_url}/${click_command}`)
            } else if (input_type == "serial") {
                send_serial(click_command)
            } else {
                console.log(`연결된 입력기가 없습니다. ${click_command}`)
            }
        }
        else {
            if (input_type == "url") {
                fetch(`${input_url}/${key}`)
            } else if (input_type == "serial") {
                send_serial(key)
            } else {
                console.log(`연결된 입력기가 없습니다. ${key}`)
            }
        }
    }
}

const cv_ready = () => {
    console.log("opencv.js ready")
    document.getElementById("btn_start").disabled = false
}

const start_capture = () => {
    document.getElementsByName("stream_select").forEach(ele => {
        if (ele.checked) {
            if (ele.value == "rtc") {
                console.log("Run WebRTC")
                window.resizeTo(600, 600)
                const constraints = { audio: false, video: true }
                navigator.mediaDevices.getDisplayMedia(constraints).then(mediaStream => {
                    video.srcObject = mediaStream
                    video.play()
                    document.getElementById("btn_start").disabled = true
                    window.resizeTo(480, 400)
                    setTimeout(rtc_loop, 1000)
                })
            } else {
                console.log("Run stream")
                stream_url = prompt("스트리밍 URL을 입력하세요.", stream_url)
                console.log(stream_url)
                localStorage.setItem("stream_url", stream_url)
                img.src = stream_url
                setTimeout(stream_loop, 1000)
            }
        }
    })
}

const rtc_loop = () => {
    video.width = video.videoWidth
    video.height = video.videoHeight
    const cap = new cv.VideoCapture(video);
    const frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    cap.read(frame);
    cv.imshow("viewer", frame)

    for (slot of Object.keys(userdata)) {
        if (userdata[slot].type == "hpslot") {
            if (run[slot] == true) {
                const x1 = userdata[slot].roi_p1[0]
                const y1 = userdata[slot].roi_p1[1]
                const x2 = userdata[slot].roi_p2[0]
                const y2 = userdata[slot].roi_p2[1]
                const thres = userdata[slot].thres

                const capture_size = userdata[slot].capture_size
                let resized_frame = new cv.Mat()
                let dsize = new cv.Size(capture_size[0], capture_size[1])
                cv.resize(frame, resized_frame, dsize, 0, 0, cv.INTER_AREA)

                let hpImg = new cv.Mat()
                let rect = new cv.Rect(x1, y1, x2 - x1, y2 - y1)
                hpImg = resized_frame.roi(rect)

                const hpImgPlanes = new cv.MatVector()
                cv.split(hpImg, hpImgPlanes);
                const hpRed = hpImgPlanes.get(0)

                const hpBlur = new cv.Mat()
                const ksize = new cv.Size(5, 5)
                const anchor = new cv.Point(-1, -1)
                cv.blur(hpRed, hpBlur, ksize, anchor, cv.BORDER_DEFAULT)

                const hpThres = new cv.Mat()
                cv.threshold(hpBlur, hpThres, thres, 255, cv.THRESH_BINARY)

                const hpData1D = []
                const hpData2D = []
                const hpMaxAry = []

                hpThres.data.forEach(value => hpData1D.push(value))

                while (hpData1D.length) hpData2D.push(hpData1D.splice(0, hpThres.size().width))

                for (i = 0; i < hpData2D.length; i++) {
                    const idx = hpData2D[i].reverse().indexOf(255)
                    const value = idx < 0 ? hpImg.size().width : idx
                    hpMaxAry.push(value)
                }

                const hpMinIdx = Math.min.apply(null, hpMaxAry) < 0 ? 0 : Math.min.apply(null, hpMaxAry)
                const hpRatio_ = Math.round((hpThres.size().width - hpMinIdx) / hpThres.size().width * 100)
                const hpRatio = hpRatio_ == 0 ? 100 : hpRatio_

                resized_frame.delete()
                hpImg.delete()
                hpImgPlanes.delete()
                hpRed.delete()
                hpBlur.delete()
                hpThres.delete()

                const min_hp = userdata[slot].hp_range[0]
                const max_hp = userdata[slot].hp_range[1]
                document.getElementById(`${slot}-value`).value = `설정[${min_hp}~${max_hp}] 인식[${hpRatio}]`

                if (hpRatio >= min_hp && hpRatio <= max_hp && cooling[slot] == false) {
                    cool_run(slot)
                    send_keys(userdata[slot])
                }
            }
        }

        if (userdata[slot].type == "imgslot" && run[slot] == true) {
            const x1 = userdata[slot].roi_p1[0]
            const y1 = userdata[slot].roi_p1[1]
            const x2 = userdata[slot].roi_p2[0]
            const y2 = userdata[slot].roi_p2[1]
            const thres = userdata[slot].thres

            const capture_size = userdata[slot].capture_size
            let resized_frame = new cv.Mat()
            let dsize = new cv.Size(capture_size[0], capture_size[1])
            cv.resize(frame, resized_frame, dsize, 0, 0, cv.INTER_AREA)

            let croppedImg = new cv.Mat()
            let rect = new cv.Rect(x1, y1, x2 - x1, y2 - y1)
            croppedImg = resized_frame.roi(rect)

            const result = new cv.Mat()
            const mask = new cv.Mat()
            cv.matchTemplate(target_img[slot], croppedImg, result, cv.TM_CCOEFF, mask)
            const roc = cv.minMaxLoc(result, mask)

            const center_x = roc.maxLoc.x + parseInt(target_img[slot].cols / 2)
            const center_y = roc.maxLoc.y + parseInt(target_img[slot].rows / 2)
            target_img_loc[slot] = [center_x, center_y]

            resized_frame.delete()
            croppedImg.delete()
            result.delete()
            mask.delete()
            document.getElementById(`${slot}-value`).value = `설정[${parseInt(thres).toLocaleString()}] 인식[${parseInt(roc.maxVal).toLocaleString()}]`

            if (roc.maxVal >= thres && cooling[slot] == false) {
                cool_run(slot)
                send_keys(userdata[slot])
            }
        }
    }
    frame.delete()
    setTimeout(rtc_loop, 1000 / fps)
}

const stream_loop = () => {
    const frame = cv.imread(img)
    cv.imshow("viewer", frame)

    for (slot of Object.keys(userdata)) {
        if (userdata[slot].type == "hpslot") {
            if (run[slot] == true) {
                const x1 = userdata[slot].roi_p1[0]
                const y1 = userdata[slot].roi_p1[1]
                const x2 = userdata[slot].roi_p2[0]
                const y2 = userdata[slot].roi_p2[1]
                const thres = userdata[slot].thres

                const capture_size = userdata[slot].capture_size
                let resized_frame = new cv.Mat()
                let dsize = new cv.Size(capture_size[0], capture_size[1])
                cv.resize(frame, resized_frame, dsize, 0, 0, cv.INTER_AREA)

                let hpImg = new cv.Mat()
                let rect = new cv.Rect(x1, y1, x2 - x1, y2 - y1)
                hpImg = resized_frame.roi(rect)

                const hpImgPlanes = new cv.MatVector()
                cv.split(hpImg, hpImgPlanes);
                const hpRed = hpImgPlanes.get(0)

                const hpBlur = new cv.Mat()
                const ksize = new cv.Size(5, 5)
                const anchor = new cv.Point(-1, -1)
                cv.blur(hpRed, hpBlur, ksize, anchor, cv.BORDER_DEFAULT)

                const hpThres = new cv.Mat()
                cv.threshold(hpBlur, hpThres, thres, 255, cv.THRESH_BINARY)

                const hpData1D = []
                const hpData2D = []
                const hpMaxAry = []

                hpThres.data.forEach(value => hpData1D.push(value))

                while (hpData1D.length) hpData2D.push(hpData1D.splice(0, hpThres.size().width))

                for (i = 0; i < hpData2D.length; i++) {
                    const idx = hpData2D[i].reverse().indexOf(255)
                    const value = idx < 0 ? hpImg.size().width : idx
                    hpMaxAry.push(value)
                }

                const hpMinIdx = Math.min.apply(null, hpMaxAry) < 0 ? 0 : Math.min.apply(null, hpMaxAry)
                const hpRatio_ = Math.round((hpThres.size().width - hpMinIdx) / hpThres.size().width * 100)
                const hpRatio = hpRatio_ == 0 ? 100 : hpRatio_

                resized_frame.delete()
                hpImg.delete()
                hpImgPlanes.delete()
                hpRed.delete()
                hpBlur.delete()
                hpThres.delete()

                const min_hp = userdata[slot].hp_range[0]
                const max_hp = userdata[slot].hp_range[1]
                document.getElementById(`${slot}-value`).value = `설정[${min_hp}~${max_hp}] 인식[${hpRatio}]`

                if (hpRatio >= min_hp && hpRatio <= max_hp && cooling[slot] == false) {
                    cool_run(slot)
                    send_keys(userdata[slot])
                }
            }
        }

        if (userdata[slot].type == "imgslot" && run[slot] == true) {
            const x1 = userdata[slot].roi_p1[0]
            const y1 = userdata[slot].roi_p1[1]
            const x2 = userdata[slot].roi_p2[0]
            const y2 = userdata[slot].roi_p2[1]
            const thres = userdata[slot].thres

            const capture_size = userdata[slot].capture_size
            let resized_frame = new cv.Mat()
            let dsize = new cv.Size(capture_size[0], capture_size[1])
            cv.resize(frame, resized_frame, dsize, 0, 0, cv.INTER_AREA)

            let croppedImg = new cv.Mat()
            let rect = new cv.Rect(x1, y1, x2 - x1, y2 - y1)
            croppedImg = resized_frame.roi(rect)

            const result = new cv.Mat()
            const mask = new cv.Mat()
            cv.matchTemplate(target_img[slot], croppedImg, result, cv.TM_CCOEFF, mask)
            const roc = cv.minMaxLoc(result, mask)

            const center_x = roc.maxLoc.x + parseInt(target_img[slot].cols / 2)
            const center_y = roc.maxLoc.y + parseInt(target_img[slot].rows / 2)
            target_img_loc[slot] = [center_x, center_y]

            resized_frame.delete()
            croppedImg.delete()
            result.delete()
            mask.delete()
            document.getElementById(`${slot}-value`).value = `설정[${parseInt(thres).toLocaleString()}] 인식[${parseInt(roc.maxVal).toLocaleString()}]`

            if (roc.maxVal >= thres && cooling[slot] == false) {
                cool_run(slot)
                send_keys(userdata[slot])
            }
        }
    }
    frame.delete()
    setTimeout(stream_loop, 1000 / fps)
}

const timer_loop = () => {
    for (slot of Object.keys(userdata)) {
        if (userdata[slot].type == "timer") {
            if (run[slot] == true && cooling[slot] == false) {
                cool_run(slot)
                send_keys(userdata[slot])
            }
        }
    }
    setTimeout(timer_loop, 1000 / fps)
}
timer_loop()

const toggle_viewer = () => {
    const view = document.getElementById("viewer").style.display
    if (view == "inline-block") {
        document.getElementById("viewer").style.display = "none"
    } else {
        document.getElementById("viewer").style.display = "inline-block"
    }
}

const toggle_setting = () => {
    const view = document.getElementById("setting_container").style.display
    if (view == "inline-block") {
        document.getElementById("setting_container").style.display = "none"
    } else {
        document.getElementById("setting_container").style.display = "inline-block"
    }
}

const toggle_control = () => {
    const view = document.getElementById("control_container").style.display
    if (view == "inline-block") {
        document.getElementById("control_container").style.display = "none"
    } else {
        document.getElementById("control_container").style.display = "inline-block"
    }
}


const load_json_file = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.multiple = true
    input.onchange = evt => {
        for (file of evt.target.files) {
            const reader = new FileReader()
            reader.onload = () => {
                const data = JSON.parse(reader.result)
                console.log(`Add ${data.name}`)
                add_slot(data)
            }
            reader.readAsText(file)
        }
    };
    input.click();
}

const add_slot = (data) => {
    userdata[data.name] = data
    cooling[data.name] = false
    run[data.name] = false
    const div = document.createElement("div")
    div.style.maxWidth = "380px"
    div.style.display = "flex"
    div.style.justifyContent = "left"

    const input = document.createElement("input")
    input.type = "checkbox"
    input.id = `${data.name}-cb`
    input.style.cursor = "pointer"
    input.onclick = () => {
        run[data.name] = !run[data.name]
        document.getElementById(`${data.name}-value`).value = ""
    }

    const label = document.createElement("label")
    label.htmlFor = `${data.name}-cb`
    label.style.display = "inline-block"
    label.style.width = "80px"
    label.style.fontWeight = "bold"
    label.innerHTML = data.name
    label.style.cursor = "pointer"
    label.style.margin = "5px"

    const value = document.createElement("input")
    value.type = "text"
    value.disabled = true
    value.style.border = "none"
    value.style.fontSize = "16px"
    value.style.width = "300px"
    value.style.marginLeft = "10px"
    value.id = `${data.name}-value`
    div.appendChild(input)
    div.appendChild(label)
    div.appendChild(value)
    document.getElementById("control_container").appendChild(div)

    if (data.type == "imgslot") {
        const im = document.createElement("img")
        im.onload = () => {
            target_img[data.name] = cv.imread(im)
        }
        im.src = data.src
    }
}

const delay = msec => {
    return new Promise(resolve => {
        setTimeout(resolve, msec)
    })
}

const make_blob = (canvasEle) => {
    const blobBin = atob(canvasEle.toDataURL().split(",")[1])
    const array = []
    for (let i = 0; i < blobBin.length; i++) {
        array.push(blobBin.charCodeAt(i))
    }
    const file = new Blob([new Uint8Array(array)], { type: "image/png" })
    return file
}

const telegram_message = (token, chat_id, msg) => {
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${msg}`
    fetch(url)
}

const telegram_photo = (token, chat_id, caption, canvas_id) => {
    const url = `https://api.telegram.org/bot${token}/sendphoto?chat_id=${chat_id}`
    const file = make_blob(document.getElementById(canvas_id));
    const teleData = new FormData()
    teleData.append("photo", file)
    teleData.append("caption", caption)
    fetch(url, {
        method: "POST",
        body: teleData
    })
}

const download_img = () => {
    const timestamp = new Date().getTime()
    const date = new Date(timestamp)
    const month = ("0" + (date.getMonth() + 1)).slice(-2)
    const day = ("0" + date.getDate()).slice(-2)
    const hour = ("0" + date.getHours()).slice(-2)
    const minute = ("0" + date.getMinutes()).slice(-2)
    const second = ("0" + date.getSeconds()).slice(-2)
    const data = document.getElementById("viewer").toDataURL("image/png")
    const link = document.createElement("a")
    link.download = `${month}${day}${hour}${minute}${second} capture.png`
    link.href = data
    link.click()
}

const popup = () => {
    window.open(window.location.href, "_blank", "width=480; height=400;location=no; menubar=no; status=no; toolbar=no")
}

const connect_input = () => {
    document.getElementsByName("input_select").forEach(ele => {
        if (ele.checked) {
            if (ele.value == "serial") {
                console.log("Connect to serial")
                connect_serial()
            } else {
                console.log("Connect to server")
                input_url = prompt("입력서버 URL을 입력하세요.", input_url)
                console.log(input_url)
                localStorage.setItem("input_url", input_url)
                input_type = "url"
            }
        }
    })
}

const connect_serial = async () => {
    try {
        const port = await navigator.serial.requestPort()
        await port.open({ baudRate: 9600 })
        writer = port.writable.getWriter()
        console.log("연결 완료")
        input_type = "serial"
    } catch (err) {
        console.error("에러: " + err)
        input_type = ""
    }
}

const send_serial = (data) => {
    const dataArrayBuffer = encoder.encode(data);
    writer.write(dataArrayBuffer);
}

const all_off = () => {
    document.querySelectorAll("input[type=checkbox]").forEach(ele => {
        ele.checked = false
    })
    for (slot of Object.keys(run)) {
        run[slot] = false
    }
}
