# utils/snowflake.py
"""
Snowflake ID Generator

64-bit distributed unique ID generator.
Format: [1-bit sign | 41-bit timestamp | 10-bit machine ID | 12-bit sequence]

Matches the TypeScript CustomSnowflake implementation.
"""

import os
import time
import threading
from typing import ClassVar


class Snowflake:
    """
    Snowflake ID generator for distributed unique IDs.
    
    Structure (64 bits):
        - 1 bit: sign (always 0 for positive)
        - 41 bits: timestamp in milliseconds (epoch offset)
        - 10 bits: machine ID (0-1023)
        - 12 bits: sequence number (0-4095)
    
    Example:
        >>> sf = Snowflake(machine_id=1)
        >>> id1 = sf.generate()
        >>> id2 = sf.generate()
        >>> id1 < id2  # IDs are time-ordered
        True
    """
    
    # Constants
    EPOCH: ClassVar[int] = 1704067200000  # 2024-01-01 00:00:00 UTC in ms
    
    MACHINE_ID_BITS: ClassVar[int] = 10
    SEQUENCE_BITS: ClassVar[int] = 12
    
    MAX_MACHINE_ID: ClassVar[int] = (1 << MACHINE_ID_BITS) - 1  # 1023
    MAX_SEQUENCE: ClassVar[int] = (1 << SEQUENCE_BITS) - 1  # 4095
    
    TIMESTAMP_SHIFT: ClassVar[int] = MACHINE_ID_BITS + SEQUENCE_BITS  # 22
    MACHINE_ID_SHIFT: ClassVar[int] = SEQUENCE_BITS  # 12
    
    def __init__(self, machine_id: int | None = None):
        """
        Initialize Snowflake generator.
        
        Args:
            machine_id: Machine ID (0-1023). Defaults to SNOWFLAKE_MACHINE_ID env var or 1.
        """
        if machine_id is None:
            machine_id = int(os.getenv("SNOWFLAKE_MACHINE_ID", "1"))
        
        if not 0 <= machine_id <= self.MAX_MACHINE_ID:
            raise ValueError(f"Machine ID must be between 0 and {self.MAX_MACHINE_ID}")
        
        self._machine_id = machine_id
        self._sequence = 0
        self._last_timestamp = -1
        self._lock = threading.Lock()
    
    @property
    def machine_id(self) -> int:
        """Get the machine ID."""
        return self._machine_id
    
    def _current_millis(self) -> int:
        """Get current time in milliseconds."""
        return int(time.time() * 1000)
    
    def _wait_next_millis(self, last_timestamp: int) -> int:
        """Wait until the next millisecond."""
        timestamp = self._current_millis()
        while timestamp <= last_timestamp:
            timestamp = self._current_millis()
        return timestamp
    
    def generate(self) -> int:
        """
        Generate a unique Snowflake ID.
        
        Returns:
            64-bit unique ID.
        
        Raises:
            RuntimeError: If clock moves backwards.
        """
        with self._lock:
            timestamp = self._current_millis()
            
            if timestamp < self._last_timestamp:
                raise RuntimeError(
                    f"Clock moved backwards. "
                    f"Refusing to generate ID for {self._last_timestamp - timestamp}ms"
                )
            
            if timestamp == self._last_timestamp:
                # Same millisecond - increment sequence
                self._sequence = (self._sequence + 1) & self.MAX_SEQUENCE
                if self._sequence == 0:
                    # Sequence exhausted, wait for next millisecond
                    timestamp = self._wait_next_millis(timestamp)
            else:
                # New millisecond - reset sequence
                self._sequence = 0
            
            self._last_timestamp = timestamp
            
            # Build the ID
            id_value = (
                ((timestamp - self.EPOCH) << self.TIMESTAMP_SHIFT) |
                (self._machine_id << self.MACHINE_ID_SHIFT) |
                self._sequence
            )
            
            return id_value
    
    def generate_str(self) -> str:
        """Generate a unique Snowflake ID as string (for backward compatibility)."""
        return str(self.generate())
    
    @classmethod
    def parse(cls, snowflake_id: int) -> dict:
        """
        Parse a Snowflake ID into its components.
        
        Args:
            snowflake_id: The ID to parse.
        
        Returns:
            Dict with timestamp, machine_id, sequence, and datetime.
        """
        sequence = snowflake_id & cls.MAX_SEQUENCE
        machine_id = (snowflake_id >> cls.MACHINE_ID_SHIFT) & cls.MAX_MACHINE_ID
        timestamp_offset = snowflake_id >> cls.TIMESTAMP_SHIFT
        timestamp = timestamp_offset + cls.EPOCH
        
        return {
            "timestamp": timestamp,
            "machine_id": machine_id,
            "sequence": sequence,
            "datetime": time.strftime(
                "%Y-%m-%d %H:%M:%S", 
                time.localtime(timestamp / 1000)
            ),
        }


# Backward compatibility alias
CustomSnowflake = Snowflake


# Global default instance
_default_snowflake: Snowflake | None = None


def get_snowflake() -> Snowflake:
    """Get the default Snowflake generator instance."""
    global _default_snowflake
    if _default_snowflake is None:
        _default_snowflake = Snowflake()
    return _default_snowflake


def generate_id() -> int:
    """Generate a Snowflake ID using the default generator."""
    return get_snowflake().generate()


def generate_id_str() -> str:
    """Generate a Snowflake ID as string using the default generator."""
    return str(generate_id())
