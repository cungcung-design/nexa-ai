"""Download the document embedding model into the image cache."""

from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def main() -> None:
    SentenceTransformer(MODEL_NAME)


if __name__ == "__main__":
    main()
