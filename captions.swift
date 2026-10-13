import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else { exit(1) }
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let out = URL(fileURLWithPath: CommandLine.arguments[2])
let data = try Data(contentsOf: input)
let items = try JSONSerialization.jsonObject(with: data) as! [[String:String]]
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let colors: [String:NSColor] = [
    "yellow": NSColor(red:1, green:0.83, blue:0.13, alpha:1),
    "cyan": NSColor(red:0.15, green:0.93, blue:0.94, alpha:1),
    "pink": NSColor(red:1, green:0.14, blue:0.53, alpha:1),
    "red": NSColor(red:1, green:0.25, blue:0.28, alpha:1),
    "green": NSColor(red:0.25, green:0.94, blue:0.42, alpha:1)
]
for (i,item) in items.enumerated() {
    let size = NSSize(width:720,height:190)
    let image = NSImage(size:size)
    image.lockFocus()
    NSColor.clear.setFill()
    NSRect(origin:.zero,size:size).fill()
    let style = item["style"] ?? "neon"
    if style == "tiktok" {
        NSColor(calibratedWhite:0.02,alpha:0.88).setFill()
        NSBezierPath(roundedRect:NSRect(x:30,y:23,width:660,height:145),xRadius:24,yRadius:24).fill()
    }
    let text = (item["text"] ?? "").uppercased()
    let para = NSMutableParagraphStyle()
    para.alignment = .center
    para.lineBreakMode = .byWordWrapping
    let shadow = NSShadow()
    shadow.shadowColor = .black
    shadow.shadowOffset = NSSize(width:3,height:-4)
    shadow.shadowBlurRadius = 6
    let ink = style == "cine" ? NSColor.white : (colors[item["color"] ?? "yellow"] ?? .white)
    var fontSize: CGFloat = style == "cine" ? 42 : 51
    var attr: [NSAttributedString.Key:Any] = [:]
    while true {
        let font = NSFont.systemFont(ofSize:fontSize, weight:style == "cine" ? .semibold : .black)
        attr = [.font:font,.foregroundColor:ink,.paragraphStyle:para,.shadow:shadow]
        let bounds = (text as NSString).boundingRect(with:NSSize(width:660,height:1000), options:[.usesLineFragmentOrigin,.usesFontLeading], attributes:attr)
        if bounds.height <= 140 || fontSize <= 28 { break }
        fontSize -= 1
    }
    (text as NSString).draw(in:NSRect(x:30,y:20,width:660,height:150),withAttributes:attr)
    image.unlockFocus()
    let rep = NSBitmapImageRep(data:image.tiffRepresentation!)!
    let png = rep.representation(using:.png,properties:[:])!
    try png.write(to:out.appendingPathComponent("caption-\(i).png"))
}
