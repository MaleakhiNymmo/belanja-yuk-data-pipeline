"""
=============================================================
test_el_logic.py — Unit Tests for Pipeline Data Hygiene Logic
=============================================================
Memverifikasi logika regex validasi email dan fungsi sanitasi
yang digunakan pada tahap Extract & Load serta Staging.
=============================================================
"""

import re
import pytest

EMAIL_REGEX = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'


def is_valid_email(email: str) -> bool:
    """Helper validator email sama dengan logika dbt staging regex."""
    if not email or not isinstance(email, str):
        return False
    return bool(re.match(EMAIL_REGEX, email.strip()))


def sanitize_stock(stock_qty: int) -> int:
    """Helper sanitasi stok sama dengan GREATEST(stock_qty, 0)."""
    return max(0, stock_qty)


def test_valid_emails():
    """Menguji email yang valid."""
    assert is_valid_email("budi.santoso@gmail.com") is True
    assert is_valid_email("dewi_a@startup.co.id") is True
    assert is_valid_email("user.name+tag@domain.org") is True


def test_invalid_dirty_emails():
    """Menguji dirty emails yang sengaja di-inject oleh Faker."""
    assert is_valid_email("budi@@gmail.com") is False      # double @
    assert is_valid_email("budi_tanpa_at.com") is False     # missing @
    assert is_valid_email("budi@domain") is False           # missing TLD
    assert is_valid_email("   budi@gmail.com") is True     # handled by strip
    assert is_valid_email("") is False                      # empty string
    assert is_valid_email(None) is False                    # null email


def test_stock_hygiene():
    """Memastikan stok negatif diubah menjadi 0."""
    assert sanitize_stock(-5) == 0
    assert sanitize_stock(-1) == 0
    assert sanitize_stock(0) == 0
    assert sanitize_stock(150) == 150
