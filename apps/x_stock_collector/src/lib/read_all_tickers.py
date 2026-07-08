"""
1. read each ticker csv file from /Users/tio/Documents/00_projects/2025_stock_trading_data/data/tickers/*
2. read line by line
    - first line is header
    - each line csv seperated
        GOOGL,stocks,XNAS,Alphabet Inc. Class A Common Stock,usd,us,CS,True,0001652044,BBG009S39JX6,2025-10-01T06:06:06.417113675Z,BBG009S39JY5
3.
"""

# list all ticker files
"""
    @param dir path
    @return file list
"""
from lib.constants import TICKER_DIR_PATH

import os
from typing import Iterator


def list_ticker_files(dir: str = TICKER_DIR_PATH) -> list[str]:
    """
    List all CSV files in the given directory.
    Returns a list of file paths.
    """
    return [
        os.path.join(dir, f)
        for f in os.listdir(dir)
        if f.endswith(".csv") and os.path.isfile(os.path.join(dir, f))
    ]


# read a file with csv
"""
    @desc open a csv file
    @return generator

    @usage
        for row in open_csv_file('data.csv'):
            print(row)
"""
import csv


def open_csv_file_generator(file: str) -> Iterator[list[str]]:
    with open(file, "r") as f:
        csv_reader = csv.reader(f)
        header = next(csv_reader)

        for row in csv_reader:
            # File stays open while yielding
            yield row


# CLI test code
if __name__ == "__main__":
    print("Ticker files:")
    files = list_ticker_files(TICKER_DIR_PATH)

    for f in files:
        print(f"\n>> file: {f}")
        gen = open_csv_file_generator(f)
        for i, row in enumerate(gen):
            print(row)
            if i >= 2:
                break
        print()
