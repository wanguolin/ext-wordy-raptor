window.onload = function () {
    let video = document.getElementsByTagName("video")[0];
    let re = document.evaluate('//*/body/script', document).iterateNext().textContent.match(/(https:\/\/www\.youtube\.com\/api\/timedtext.*?)",/);

    if (re.length <= 1) {
        console.log("e", re)
        return
    }

    // 获取字幕
    let url = JSON.parse('{"u":"' + re[1] + '"}')["u"].replace("?", "?lang=en&fmt=json3&");
    console.log(url)
    fetch(url).then((r) => r.text()).then(r => {
        console.log("fetched");

        new Raptor(video,
            Subtitles.YOUTUBE(r, (t => { video.currentTime = t })),
            // 添加样式 屏蔽原字幕
            `
            .captions-text {
                opacity: 0;
            }
            `,
            video.parentElement.parentElement
        );
    }).catch(e => console.log(e));

    // ytInitialPlayerResponse["captions"]["playerCaptionsTracklistRenderer"]["captionTracks"][0]["baseUrl"]
}