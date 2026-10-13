declare module "word-extractor" {
  class ExtractedDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getAnnotations(): string;
    getHeaders(): string[];
    getFooters(): string[];
  }
  class WordExtractor {
    extract(file: Buffer | string): Promise<ExtractedDocument>;
  }
  export = WordExtractor;
}