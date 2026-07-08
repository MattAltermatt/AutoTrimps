// Pure time formatting — no game/DOM/legacy dependencies. Fully unit-testable.
// Bodies are the verbatim legacy implementations; only return/var type annotations
// were added (no logic change).
export function timeStamp(): string {for(var a=new Date,b:any[]=[a.getHours(),a.getMinutes(),a.getSeconds()],c=1;3>c;c++)10>b[c]&&(b[c]="0"+b[c]);return b.join(":")}

export function formatMinutesForDescriptions(number: number): string {
    var text;
    var seconds: any = Math.floor((number*60) % 60);
    var minutes: any = Math.floor(number % 60);
    var hours = Math.floor(number / 60);
    if (hours == 0)
        text = minutes + " minutes " + seconds + " seconds";
    else if (minutes > 0) {
        if (minutes < 10) minutes = "0" + minutes;
        if (seconds < 10) seconds = "0" + seconds;
        text = hours + ":" + minutes + ":" + seconds;
    }
    else {
        var hs = (hours > 1) ? "s" : "";
        var ms = (minutes > 1) ? "s" : "";
        var ss = (seconds > 1) ? "s" : "";
        text = hours + " hour" + hs + " " + minutes + " minute" + ms + " " + seconds + " second" + ss;
    }
    return text;
}
