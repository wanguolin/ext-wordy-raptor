class Subtitle {
    text;
    startTime;
    endTime

    constructor(text, startTime, endTime) {
        this.text = text;
        this.startTime = startTime;
        this.endTime = endTime;
    }
}

class Subtitles {
    subtitleList = [];
    index = -1;
    loopIndex = -1;
    onSeekToListener = null;

    static WEBVTT(content, onSeekToListener) {
        function toSeconds(t) {
            var s = 0.0;
            if (t) {
                var p = t.split(":");
                for (let i = 0; i < p.length; i++) {
                    s = s * 60 + parseFloat(p[i].replace(",", "."));
                }
            }
            return s;
        }
        var subtitles = new Subtitles();
        subtitles.onSeekToListener = onSeekToListener;
        subtitles.subtitleList = content.split(/\n\n/)
            .filter(item => item != "WEBVTT" && item != "")
            .map((item, index) => {
                let textItem = item.split(/\n/);
                let timeLine = textItem[0];
                let startTime = toSeconds(timeLine.split(" --> ")[0]);
                let endTime = toSeconds(timeLine.split(" --> ")[1].split(" ")[0]);

                textItem.shift();
                return new Subtitle(textItem.join("\n"), startTime, endTime);
            });
        return subtitles;
    }

    static YOUTUBE(content, onSeekToListener) {
        var subtitles = new Subtitles();
        subtitles.onSeekToListener = onSeekToListener;

        var events = JSON.parse(content)["events"];

        for (var i in events) {
            var subtitle = null;

            if (subtitles.subtitleList.length > 0) {
                subtitle = subtitles.subtitleList[subtitles.subtitleList.length - 1];
            }

            var event_ = events[i];
            if (!event_["segs"] || event_["segs"].length < 1) {
                continue;
            }

            var startTime = event_["tStartMs"] / 1000;
            var endTime = (event_["tStartMs"] + event_["dDurationMs"]) / 1000;
            let textItem = event_["segs"].map(t => t["utf8"]).join(" ");

            if (subtitle == null || subtitle.endTime <= startTime) {
                subtitles.subtitleList.push(new Subtitle(textItem, startTime, endTime));
            } else {
                subtitles.subtitleList[subtitles.subtitleList.length - 1].text += textItem;
            }
        }
        // console.log(subtitles.subtitleList);
        return subtitles;
    }

    setOnSeekToListener(onSeekToListener) {
        this.onSeekToListener = onSeekToListener;
    }


    getIndexByTime(time) {
        if (this.index == -1) {
            return this.subtitleList.findIndex((e) => time >= e.startTime && time <= e.endTime);
        }

        if (this.subtitleList[this.index] && time > this.subtitleList[this.index].endTime) {
            return this.index + 1;
        }
        return this.index;
    }

    reLoad() {
        if (this.loopIndex == -1) {
            this.index = -1;
        }
    }


    toNext() {
        this.loopIndex = -1;
        this.index += 1;
        if (this.index > this.subtitleList.length - 1) {
            this.index = this.subtitleList.length - 1;
        }
        this.rePlay();
    }

    toPre() {
        this.loopIndex = -1;
        this.index -= 1;
        if (this.index < 0) {
            this.index = 0;
        }
        this.rePlay();
    }

    rePlay() {
        // console.log("replay", this.index)
        if (this.onSeekToListener != null && this.index != -1) {
            this.onSeekToListener(this.subtitleList[this.index].startTime);
        }
    }

    lookupWord(word) {
        const start_with = word[0];
        const dict_file = chrome.runtime.getURL('dict/Websters/start_with_' + start_with + '.json');
        console.log(dict_file);
        fetch(dict_file).then(response => response.json()).then(data => {
            if (data[word]) {
                return data[word];
            } else {
                return "not found";
            }
        });
    }

    getCurrentSubtitleElement(currentTime) {
        this.index = this.getIndexByTime(currentTime);
        if (this.index != -1) {

            let text = this.subtitleList[this.index].text;

            let div = createElement("div", "css-subtitle");
            div.onmouseleave = () => {
                this.loopIndex = -1;
            };

            text.split(" ").forEach(word => {
                let words = createElement("span", "css-words");
                let w = createElement("span")
                w.innerText = word;
                let tt = createElement("span", "css-tt");

                tt.innerHTML = word;
                words.onmouseenter = () => {
                    console.log("onmouseenter", word);
                    tt.style.visibility = "visible";
                    tt.style.left = -(tt.offsetWidth - w.offsetWidth) / 2 + "px";
                    this.loopIndex = this.index;
                    //tt.innerHTML = this.lookupWord(word);
                    const start_with = word[0];
                    const dict_file = chrome.runtime.getURL('dict/Websters/start_with_' + start_with + '.json');
                    console.log(dict_file);
                    fetch(dict_file).then(response => response.json()).then(data => {
                        tt.innerHTML = data[word] ? data[word] : "not found";
                    });
                };
                words.onmouseleave = () => {
                    tt.style.visibility = "hidden";
                };

                words.append(tt);
                words.append(w);
                div.append(words);
                div.append(" ");
            })

            return div;
        }
        return null;
    }

    getLoopEndTime() {
        if (this.loopIndex != -1) {
            return this.subtitleList[this.loopIndex].endTime;
        }
        return -1;
    }
}

function createElement(tagName, clazz) {
    let e = document.createElement(tagName);
    if (clazz != null) {
        e.setAttribute("class", clazz);
    }
    return e;
}

class Raptor {
    video = null;
    subtitles = null;

    constructor(video, subtitles, style, parentElement) {
        this.video = video;
        this.subtitles = subtitles;

        let subtitleRoot = createElement("div", "css-subtitle-root");

        parentElement.appendChild(subtitleRoot);

        this.video.addEventListener("seeking", (e) => {
            this.subtitles.reLoad();
        })

        this.video.addEventListener("timeupdate", (e) => {

            // console.log(this.video.currentTime)
            let loopEndTime = this.subtitles.getLoopEndTime();

            if (loopEndTime != -1) {
                // console.log(loopEndTime, this.video.currentTime >= loopEndTime, !this.video.paused)
                if (this.video.currentTime >= loopEndTime && !this.video.paused) {
                    this.video.pause();
                }
                return;
            }

            let subtitleElement = this.subtitles.getCurrentSubtitleElement(this.video.currentTime);
            if (subtitleElement != null) {
                // console.log(subtitleElement);
                subtitleRoot.innerHTML = "";
                subtitleRoot.appendChild(subtitleElement);
            }
        })

        this.subtitles.setOnSeekToListener((startTime) => {
            if (this.video.paused) {
                this.video.play();
            }
            this.video.currentTime = startTime;
        });

        document.addEventListener('keydown', (event) => {
            var name = event.key;
            var code = event.code;
            if (name === 'd') {
                this.subtitles.toNext();
            } else if (name === 's') {
                this.subtitles.rePlay();
            } else if (name === 'a') {
                this.subtitles.toPre();
            }
        }, false);

        this.addStyle(`
        .css-subtitle-root{
            background: rgba(0,0,0,.8);
            position: absolute;
            z-index: 100;
            bottom: 4rem;
            left: 0;
            right: 0;
            text-align: center;
        }
        .css-subtitle {
            box-sizing: border-box;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
            bottom: 6rem;
            font-size: 1.2rem;
          }
        .css-words{
            white-space: nowrap;
            cursor: pointer;
            border-radius: 4px;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            border-bottom-right-radius: 4px;
            border-bottom-left-radius: 4px;
            position: relative;
            color: #fff;
            font-size: 20px;
          }
        .css-tt{
            width: auto;
            background: #00639e;
            visibility: hidden;
            position: absolute;
            transform: translateY(-50%);
            padding: 5px 12px;
            z-index: 100;
            color: #ffffff;
            font-size: 14px;
            font-weight: 500;
            line-height: 18px;
            border-radius: 4px;
            transition: none;
            pointer-events: none;  
            bottom: 0.5rem;
            top: auto;
          }
        `)

        this.addStyle(style);
    }



    addStyle(s) {
        const style = document.createElement('style');
        style.innerHTML = s;
        document.head.appendChild(style);
    }
}
