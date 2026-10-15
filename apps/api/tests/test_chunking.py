import pytest

from app.ai.chunking import split_text


def test_split_text_returns_overlapping_chunks():
    chunks = split_text("a" * 1000, chunk_size=800, overlap=120)

    assert len(chunks) == 2
    assert len(chunks[0]) == 800
    assert chunks[1] == "a" * 320


def test_split_text_rejects_invalid_overlap():
    with pytest.raises(ValueError):
        split_text("hello", chunk_size=100, overlap=100)


def test_split_text_collapses_blank_input():
    assert split_text("   \n\t  ") == []
