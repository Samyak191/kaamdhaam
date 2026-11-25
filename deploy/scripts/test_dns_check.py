"""DNS preflight must retry transient failures but still fail closed on a wrong or malformed address."""
import os
import subprocess
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("dns-check.sh")


class DnsCheckTests(unittest.TestCase):
    def run_check(self, host, expected, attempts="2"):
        env = dict(os.environ, DNS_CHECK_ATTEMPTS=attempts, DNS_CHECK_DELAY_SECONDS="0")
        return subprocess.run([os.environ.get("BASH", "bash"), str(SCRIPT), host, expected], env=env, text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)

    def test_localhost_resolves_to_loopback(self):
        result = self.run_check("localhost", "127.0.0.1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("resolves to approved 127.0.0.1", result.stdout)

    def test_wrong_address_fails_after_retries(self):
        result = self.run_check("localhost", "192.0.2.1", attempts="3")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stderr.count("attempt"), 3)
        self.assertIn("resolved to [127.0.0.1]", result.stderr)
        self.assertIn("Staging DNS does not resolve", result.stderr)

    def test_unresolvable_host_reports_empty_lookup(self):
        result = self.run_check("unresolvable.invalid", "192.0.2.1")
        self.assertEqual(result.returncode, 2)
        self.assertIn("returned no IPv4 address", result.stderr)

    def test_trailing_whitespace_in_expected_fails_closed(self):
        result = self.run_check("localhost", "127.0.0.1 ")
        self.assertEqual(result.returncode, 2)
        self.assertIn("issue=whitespace", result.stderr)

    def test_non_ascii_expected_fails_closed(self):
        result = self.run_check("localhost", "127.0.0.1\u00a0")
        self.assertEqual(result.returncode, 2)
        self.assertIn("issue=non_ascii", result.stderr)


if __name__ == "__main__":
    unittest.main()
