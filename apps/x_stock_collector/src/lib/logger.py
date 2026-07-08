import os
import csv
from abc import ABC, abstractmethod
from datetime import datetime


class Logger(ABC):
    @abstractmethod
    def write(self, topic: str, log_type: str, msg: str):
        pass


import socket


class LocalLogger(Logger):
    def __init__(self, log_dir: str = "logs"):
        self.log_dir = log_dir
        os.makedirs(self.log_dir, exist_ok=True)
        self.machine_name = socket.gethostname()

    def write(self, topic: str, log_type: str = "INFO", status: str = "-", msg=None):
        now_dt = datetime.now()
        now = now_dt.isoformat() or "-"
        topic_val = topic if topic else "-"
        log_type_val = log_type if log_type else "INFO"
        status_val = status if status else "-"
        machine_val = self.machine_name if self.machine_name else "-"
        # Only support array (list/tuple) for msg
        if isinstance(msg, (list, tuple)):
            msg_str = "|".join(str(m) if m else "-" for m in msg)
        else:
            msg_str = str(msg) if msg else "-"
        msg_str = f"'{msg_str}'"
        # logs/YYYY/MM/DD/topic.csv
        log_file = os.path.join(
            self.log_dir,
            now_dt.strftime("%Y"),
            now_dt.strftime("%m"),
            now_dt.strftime("%d"),
            f"{topic}.csv"
        )
        
        os.makedirs(os.path.dirname(log_file), exist_ok=True)

        row = [now, log_type_val, topic_val, status_val, machine_val, msg_str]
        file_exists = os.path.isfile(log_file)
        with open(log_file, mode="a", newline="") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(
                    ["time", "level", "topic", "status", "machine_name", "msg"]
                )
            writer.writerow(row)


# CLI test code
if __name__ == "__main__":
    logger = LocalLogger()
    logger.write("log.test", msg=["This", "is", "a", "test", "message"])
    logger.write(
        "log.test", log_type="ERROR", status="fail", msg=["bob", "logout", "fail"]
    )
    logger.write(
        "log.test", log_type="INFO", status="ok", msg=["alice", "login", "success"]
    )
    print("Wrote test log entries to logs/test.log.csv")
