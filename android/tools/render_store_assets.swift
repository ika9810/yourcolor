import AppKit

func render(_ name: String, width: Int, height: Int) throws {
    let directory = URL(fileURLWithPath: "release-assets", isDirectory: true)
    let source = directory.appendingPathComponent("\(name).svg")
    let destination = directory.appendingPathComponent("\(name).png")
    guard let image = NSImage(contentsOf: source) else { fatalError("Cannot read \(source.path)") }
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                                       bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                       isPlanar: false, colorSpaceName: .deviceRGB,
                                       bytesPerRow: 0, bitsPerPixel: 0),
          let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fatalError("Cannot create PNG bitmap")
    }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    NSColor.white.setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()
    image.draw(in: NSRect(x: 0, y: 0, width: width, height: height))
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("PNG encoding failed") }
    try png.write(to: destination)
}

try render("store-icon", width: 512, height: 512)
try render("feature-graphic", width: 1024, height: 500)
