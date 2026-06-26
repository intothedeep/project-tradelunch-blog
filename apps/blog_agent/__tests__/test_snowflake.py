import unittest
import time
import threading
from utils.snowflake import CustomSnowflake

class TestCustomSnowflake(unittest.TestCase):
    
    def setUp(self):
        """Set up snowflake instance"""
        self.snowflake = CustomSnowflake(machine_id=1)
        
    def test_generate_unique_ids(self):
        """Test that generated IDs are unique"""
        ids = set()
        count = 1000
        for _ in range(count):
            ids.add(self.snowflake.generate())
        self.assertEqual(len(ids), count)

    def test_generate_increasing_ids(self):
        """Test that generated IDs are increasing"""
        id1 = int(self.snowflake.generate())
        id2 = int(self.snowflake.generate())
        self.assertLess(id1, id2)

    def test_id_structure(self):
        """Test the structure of the generated ID"""
        id_val = self.snowflake.generate()
        id_str = str(id_val)
        
        # Check that ID is roughly valid
        # EPOCH is 2024-01-01. Current time is > 2024.
        self.assertTrue(len(id_str) >= 18)
        
        # Extract components
        sequence_mask = (1 << 12) - 1
        machine_id_mask = (1 << 10) - 1
        
        sequence = id_val & sequence_mask
        machine_id = (id_val >> 12) & machine_id_mask
        timestamp_part = (id_val >> 22)
        
        self.assertEqual(machine_id, 1)
        # Sequence might be 0 or small number
        self.assertTrue(0 <= sequence < 4096)
        
        # Timestamp check
        current_time_ms = int(time.time() * 1000)
        # Use the EPOCH from the class if available, else hardcode based on utils/snowflake.py
        epoch = CustomSnowflake.EPOCH 
        calculated_timestamp = timestamp_part + epoch
        
        # Allow small delta (1 sec)
        self.assertTrue(abs(current_time_ms - calculated_timestamp) < 1000)

    def test_thread_safety(self):
        """Test thread safety of ID generation"""
        ids = set()
        lock = threading.Lock()
        
        # Create a shared instance for threads
        shared_snowflake = CustomSnowflake(machine_id=2)
        
        def generate_ids():
            for _ in range(100):
                new_id = shared_snowflake.generate()
                with lock:
                    ids.add(new_id)
        
        threads = []
        for _ in range(10):
            t = threading.Thread(target=generate_ids)
            threads.append(t)
            t.start()
            
        for t in threads:
            t.join()
            
        self.assertEqual(len(ids), 1000)

if __name__ == '__main__':
    unittest.main()
