import unittest
from urllib.parse import urlparse

# Simple host_allowed implementation mirroring the patched logic in patch_openai_router.py

def host_allowed(host: str, allowlist_csv: str = "open-persona-sidecar,localhost,127.0.0.1") -> bool:
    if not host:
        return False
    allowlist = set([h.strip().lower() for h in allowlist_csv.split(',') if h.strip()])
    h = host.lower()
    if h in allowlist:
        return True
    if h.endswith('.svc.cluster.local'):
        base = h.split('.')[0]
        if base in allowlist:
            return True
    return False

class TestAllowlist(unittest.TestCase):
    def test_exact_match(self):
        self.assertTrue(host_allowed('open-persona-sidecar'))
        self.assertTrue(host_allowed('localhost'))
    def test_cluster_local(self):
        self.assertTrue(host_allowed('open-persona-sidecar.default.svc.cluster.local'))
    def test_negative(self):
        self.assertFalse(host_allowed('open-persona-sidecar.evil.com'))
        self.assertFalse(host_allowed('example.com'))
    def test_empty(self):
        self.assertFalse(host_allowed(''))

if __name__ == '__main__':
    unittest.main()
