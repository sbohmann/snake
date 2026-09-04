#!/usr/bin/env python3
import argparse
import random
import select
import shutil
import signal
import sys
import termios
import time
import tty
from dataclasses import dataclass
from enum import Enum


CSI = "\x1b["
RESET = "\x1b[0m"
HIDE_CURSOR = CSI + "?25l"
SHOW_CURSOR = CSI + "?25h"
ALT_SCREEN = CSI + "?1049h"
MAIN_SCREEN = CSI + "?1049l"

BG_PAGE = 23
FG_BLUE = 147
FG_HELP = 223
FG_LINK = 204
BOARD_BG = 229
SNAKE = 16
APPLE = 196
FAIL = 197


class Direction(Enum):
    NONE = (0, 0)
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)


OPPOSITE = {
    Direction.UP: Direction.DOWN,
    Direction.DOWN: Direction.UP,
    Direction.LEFT: Direction.RIGHT,
    Direction.RIGHT: Direction.LEFT,
}


KEY_TO_DIRECTION = {
    "UP": Direction.UP,
    "k": Direction.UP,
    "w": Direction.UP,
    "d": Direction.UP,
    "DOWN": Direction.DOWN,
    "j": Direction.DOWN,
    "s": Direction.DOWN,
    "LEFT": Direction.LEFT,
    "h": Direction.LEFT,
    "a": Direction.LEFT,
    "RIGHT": Direction.RIGHT,
    "l": Direction.RIGHT,
    "f": Direction.RIGHT,
    " ": Direction.NONE,
}


@dataclass(frozen=True)
class Point:
    x: int
    y: int


class Terminal:
    def __init__(self):
        self.fd = sys.stdin.fileno()
        self.old_attrs = None

    def __enter__(self):
        self.old_attrs = termios.tcgetattr(self.fd)
        tty.setcbreak(self.fd)
        sys.stdout.write(ALT_SCREEN + HIDE_CURSOR)
        sys.stdout.flush()
        return self

    def __exit__(self, exc_type, exc, tb):
        sys.stdout.write(RESET + SHOW_CURSOR + MAIN_SCREEN)
        sys.stdout.flush()
        if self.old_attrs is not None:
            termios.tcsetattr(self.fd, termios.TCSADRAIN, self.old_attrs)

    def read_key(self):
        if not select.select([sys.stdin], [], [], 0)[0]:
            return None

        ch = sys.stdin.read(1)
        if ch == "\x1b":
            if not select.select([sys.stdin], [], [], 0.01)[0]:
                return "ESC"
            seq = sys.stdin.read(1)
            if seq != "[" or not select.select([sys.stdin], [], [], 0.01)[0]:
                return "ESC"
            final = sys.stdin.read(1)
            return {"A": "UP", "B": "DOWN", "C": "RIGHT", "D": "LEFT"}.get(final)
        if ch in ("\x03", "\x04", "q", "Q"):
            return "QUIT"
        if ch in ("\r", "\n"):
            return "ENTER"
        return ch.lower()

    def drain_keys(self):
        keys = []
        while True:
            key = self.read_key()
            if key is None:
                return keys
            keys.append(key)


class SnakeGame:
    def __init__(self, board_size):
        self.width = board_size
        self.height = board_size
        self.reset()

    def reset(self):
        self.current_position = Point(0, 0)
        self.current_direction = Direction.NONE
        self.last_direction = None
        self.direction_queue = []
        self.snake_fields = []
        self.occupied = set()
        self.snake_length = 20
        self.failed = False
        self.delay = self.grid_delay()
        self.score = 0
        self.apple_position = None
        self.process_current_position()
        self.apple_position = self.calculate_apple_position()

    def grid_delay(self):
        grid_size = 800 // self.width
        return grid_size * 0.005

    def enqueue_direction(self, direction):
        self.direction_queue.append(direction)

    def step(self):
        if self.failed:
            return False

        while self.direction_queue:
            new_direction = self.direction_queue.pop(0)
            if self.direction_applicable(new_direction):
                self.current_direction = new_direction
                break

        dx, dy = self.current_direction.value
        new_position = Point(self.current_position.x + dx, self.current_position.y + dy)
        if new_position == self.current_position:
            return False

        if not self.inside_board(new_position) or self.hit_snake(new_position):
            self.failed = True
            return True

        self.current_position = new_position
        self.process_current_position()
        return True

    def process_current_position(self):
        self.occupied.add(self.current_position)
        self.snake_fields.append(self.current_position)
        if len(self.snake_fields) > self.snake_length:
            last_field = self.snake_fields.pop(0)
            if last_field != self.current_position:
                self.occupied.discard(last_field)

        if self.apple_position == self.current_position:
            self.snake_length += 1
            self.apple_position = self.calculate_apple_position()
            self.score += 1
            if self.delay > 0.020:
                self.delay -= 0.001

    def calculate_apple_position(self):
        free_fields = [
            Point(x, y)
            for y in range(self.height)
            for x in range(self.width)
            if Point(x, y) not in self.occupied
        ]
        if not free_fields:
            return None
        return random.choice(free_fields)

    def hit_snake(self, point):
        return point in self.occupied and not self.at_last_field_of_snake(point)

    def at_last_field_of_snake(self, point):
        return bool(self.snake_fields) and point == self.snake_fields[0]

    def direction_applicable(self, direction):
        if direction == Direction.NONE and self.current_direction != Direction.NONE:
            self.last_direction = self.current_direction
            return True

        if self.current_direction == Direction.NONE:
            return direction != OPPOSITE.get(self.last_direction)
        if self.current_direction in (Direction.UP, Direction.DOWN):
            return direction in (Direction.LEFT, Direction.RIGHT)
        if self.current_direction in (Direction.LEFT, Direction.RIGHT):
            return direction in (Direction.UP, Direction.DOWN)
        return False

    def inside_board(self, point):
        return 0 <= point.x < self.width and 0 <= point.y < self.height


class Renderer:
    def __init__(self, board_size):
        self.board_size = board_size
        self.last_frame = None
        self.use_half_blocks = True
        self.cell_cols = 1
        self.cell_rows = 1
        self.origin_x = 1
        self.origin_y = 1

    def configure(self):
        size = shutil.get_terminal_size((100, 40))
        self.use_half_blocks = self.board_size == 40
        self.cell_cols = max(1, 40 // self.board_size)
        self.cell_rows = self.cell_cols // 2 or 1
        if self.use_half_blocks:
            board_cols = self.board_size
            board_rows = self.board_size // 2
        else:
            board_cols = self.board_size * self.cell_cols
            board_rows = self.board_size * self.cell_rows
        if board_rows + 3 > size.lines and self.board_size < 40:
            self.use_half_blocks = True
            board_cols = self.board_size
        self.origin_x = max(1, (size.columns - board_cols) // 2 + 1)
        self.origin_y = 3

    def render_start(self, selected_index):
        self.configure()
        options = ["40 x 40", "20 x 20", "10 x 10"]
        size = shutil.get_terminal_size((100, 40))
        lines = [
            "",
            self.center(color("snek", FG_BLUE, bold=True), size.columns),
            "",
        ]
        for index, option in enumerate(options):
            marker = ">" if index == selected_index else " "
            lines.append(self.center(color(f"{marker} {option}", FG_LINK, bold=True), size.columns))
        lines.extend([
            "",
            self.center(color("arrows or wasd select, enter starts, q quits", FG_HELP), size.columns),
            "",
            self.center(color("space pauses, escape restarts", FG_HELP), size.columns),
        ])
        sys.stdout.write(clear_screen() + bg(BG_PAGE) + "\n".join(lines) + RESET)
        sys.stdout.flush()

    def render_game(self, game):
        self.configure()
        board_lines = self.board_lines(game)
        status = color(str(game.score), FG_BLUE, bold=True)
        if game.failed:
            status += color("  crashed - press Esc to restart or q to quit", FG_LINK, bold=True)
        else:
            status += color("  arrows/wasd move, space pauses, Esc restarts, q quits", FG_HELP)

        output = [clear_screen(), bg(BG_PAGE)]
        output.append(move_to(1, 1))
        output.append(self.center(status, shutil.get_terminal_size((100, 40)).columns))
        for row, line in enumerate(board_lines):
            output.append(move_to(self.origin_y + row, self.origin_x))
            output.append(line)
        output.append(RESET)
        frame = "".join(output)
        if frame != self.last_frame:
            sys.stdout.write(frame)
            sys.stdout.flush()
            self.last_frame = frame

    def board_lines(self, game):
        if self.use_half_blocks:
            return self.half_block_lines(game)
        return self.full_block_lines(game)

    def full_block_lines(self, game):
        lines = []
        for y in range(game.height):
            row = "".join(
                fg(self.cell_color(game, Point(x, y))) + ("█" * self.cell_cols)
                for x in range(game.width)
            ) + RESET
            for _ in range(self.cell_rows):
                lines.append(row)
        return lines

    def half_block_lines(self, game):
        lines = []
        for y in range(0, game.height, 2):
            parts = []
            for x in range(game.width):
                upper = self.cell_color(game, Point(x, y))
                lower = self.cell_color(game, Point(x, y + 1)) if y + 1 < game.height else BOARD_BG
                parts.append(fg(upper) + bg(lower) + "▀")
            lines.append("".join(parts) + RESET)
        return lines

    def cell_color(self, game, point):
        if game.failed:
            return FAIL
        if game.apple_position == point:
            return APPLE
        if point in game.occupied:
            return SNAKE
        return BOARD_BG

    @staticmethod
    def center(text, width):
        return text.center(width + ansi_length_delta(text))


def main():
    parser = argparse.ArgumentParser(description="ANSI terminal Snake")
    parser.add_argument(
        "size",
        nargs="?",
        type=int,
        choices=(10, 20, 40),
        help="playfield size; omit to show the start screen",
    )
    args = parser.parse_args()

    random.seed()
    signal.signal(signal.SIGINT, lambda _sig, _frame: raise_keyboard_interrupt())
    with Terminal() as terminal:
        board_size = args.size or start_screen(terminal)
        if board_size is None:
            return 0
        run_game(terminal, board_size)
    return 0


def start_screen(terminal):
    renderer = Renderer(40)
    sizes = [40, 20, 10]
    selected = 0
    renderer.render_start(selected)
    while True:
        key = terminal.read_key()
        if key is None:
            time.sleep(0.02)
            continue
        if key == "QUIT":
            return None
        if key in ("ENTER", " "):
            return sizes[selected]
        if key in ("UP", "w", "k", "d"):
            selected = (selected - 1) % len(sizes)
        if key in ("DOWN", "s", "j"):
            selected = (selected + 1) % len(sizes)
        if key in ("1", "2", "3"):
            return sizes[int(key) - 1]
        renderer.render_start(selected)


def run_game(terminal, board_size):
    game = SnakeGame(board_size)
    renderer = Renderer(board_size)
    renderer.render_game(game)
    next_tick = time.monotonic() + game.delay

    while True:
        for key in terminal.drain_keys():
            if key == "QUIT":
                return
            if key == "ESC":
                game.reset()
                renderer.last_frame = None
                next_tick = time.monotonic() + game.delay
                continue
            direction = KEY_TO_DIRECTION.get(key)
            if direction is not None:
                game.enqueue_direction(direction)

        now = time.monotonic()
        if now >= next_tick:
            game.step()
            renderer.render_game(game)
            next_tick = now + game.delay
        else:
            time.sleep(min(0.02, next_tick - now))


def raise_keyboard_interrupt():
    raise KeyboardInterrupt


def color(text, color_id, bold=False):
    weight = "1;" if bold else ""
    return f"{CSI}{weight}38;5;{color_id}m{text}{RESET}{bg(BG_PAGE)}"


def fg(color_id):
    return f"{CSI}38;5;{color_id}m"


def bg(color_id):
    return f"{CSI}48;5;{color_id}m"


def clear_screen():
    return CSI + "2J" + CSI + "H"


def move_to(row, col):
    return f"{CSI}{row};{col}H"


def ansi_length_delta(text):
    visible = 0
    in_escape = False
    for ch in text:
        if ch == "\x1b":
            in_escape = True
        elif in_escape and ch.isalpha():
            in_escape = False
        elif not in_escape:
            visible += 1
    return len(text) - visible


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        pass
