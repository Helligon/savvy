import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";
import { ReadableStream } from "stream/web";

// Polyfill TextEncoder/TextDecoder for jsdom
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder as typeof global.TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

// Polyfill ReadableStream for jsdom
if (typeof global.ReadableStream === "undefined") {
  global.ReadableStream =
    ReadableStream as unknown as typeof global.ReadableStream;
}

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = jest.fn();
