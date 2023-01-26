window.onload = function () {
    let video = document.getElementsByTagName("video")[0];
    video.addEventListener("loadedmetadata", (e) => {
        console.log("loadedmetadata")

        // 获取字幕
        let url = document.evaluate('//*/track[@srclang="en"]/@src', document).iterateNext().textContent;
        fetch(url).then((r) => r.text()).then(r => {
            console.log("fetched");
            
            new Raptor(video,
                // webvtt格式字幕
                Subtitles.WEBVTT(r, (t => { video.currentTime = t })),
                // 添加样式 屏蔽原字幕
                `
                .css-1bg08yq {
                    display: none;
                  }
                `,
                video.parentElement
            );
        }).catch(e => console.log(e));
    })
}

