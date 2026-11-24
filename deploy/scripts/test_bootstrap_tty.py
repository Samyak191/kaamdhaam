"""Regression tests for the bootstrap heredoc's Session Manager input path."""
import os
import select
import subprocess
import sys
import unittest
from pathlib import Path


@unittest.skipUnless(os.name == "posix", "Requires a POSIX pseudo-terminal")
class BootstrapTerminalTests(unittest.TestCase):
    def read_until(self, fd, marker):
        output = bytearray()
        while marker not in output:
            ready, _, _ = select.select([fd], [], [], 5)
            self.assertTrue(ready, "Terminal prompt timed out")
            output.extend(os.read(fd, 4096))
        return bytes(output)

    def exercise(self, hidden):
        import fcntl
        import pty
        import termios

        script = Path(__file__).with_name("bootstrap-existing-ec2.sh")
        # Compile the actual heredoc function, so this test follows script changes.
        child_code = """
import ast, io, os, sys, termios
from pathlib import Path
source = Path(sys.argv[1]).read_text()
heredoc = source.split("<<'PY'", 1)[1].split("\\nPY\\n", 1)[0]
function = next(n for n in ast.parse(heredoc).body
                if isinstance(n, ast.FunctionDef) and n.name == 'read_tty_line')
namespace = {'os': os, 'termios': termios}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(sys.argv[1]), 'exec'), namespace)
assert not sys.stdin.seekable()
try:
    with open('/dev/tty', 'r+'):
        pass
except io.UnsupportedOperation:
    pass
else:
    raise AssertionError('The old read/write text mode unexpectedly succeeded')
fd = os.open('/dev/tty', os.O_RDONLY | os.O_NOCTTY)
try:
    os.lseek(fd, 0, os.SEEK_CUR)
except OSError:
    pass
else:
    raise AssertionError('Test terminal unexpectedly supports seeking')
before = termios.tcgetattr(fd)
assert namespace['read_tty_line']('Input: ', hidden=sys.argv[2] == 'hidden') == sys.argv[3]
assert termios.tcgetattr(fd) == before
os.close(fd)
print('PASS')
"""
        value = "sb_publishable_synthetic_test" if hidden else "https://example.invalid"
        master, slave = pty.openpty()

        def controlling_terminal():
            os.setsid()
            fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

        try:
            process = subprocess.Popen(
                [sys.executable, "-c", child_code, str(script),
                 "hidden" if hidden else "visible", value],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                pass_fds=(slave,), preexec_fn=controlling_terminal,
            )
            os.close(slave)
            slave = -1
            terminal_output = self.read_until(master, b"Input: ")
            os.write(master, value.encode() + b"\n")
            stdout, stderr = process.communicate(timeout=5)
            while select.select([master], [], [], 0)[0]:
                try:
                    terminal_output += os.read(master, 4096)
                except OSError:  # PTY master signals closed slave with EIO on Linux.
                    break
            self.assertEqual(process.returncode, 0, stderr.decode())
            self.assertEqual(stdout, b"PASS\n")
            if hidden:
                self.assertNotIn(value.encode(), terminal_output)
                self.assertNotIn(value.encode(), stderr)
        finally:
            os.close(master)
            if slave >= 0:
                os.close(slave)

    def test_visible_input_with_nonseekable_stdin(self):
        self.exercise(hidden=False)

    def test_hidden_input_with_nonseekable_stdin(self):
        self.exercise(hidden=True)


if __name__ == "__main__":
    unittest.main()
