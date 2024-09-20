window.onload = setup

const Up = Object.freeze({keyCode: 'ArrowUp', name: 'Up', move: moveFunction(0, -1)})
const Down = Object.freeze({keyCode: 'ArrowDown', name: 'Down', move: moveFunction(0, 1)})
const Left = Object.freeze({keyCode: 'ArrowLeft', name: 'Left', move: moveFunction(-1, 0)})
const Right = Object.freeze({keyCode: 'ArrowRight', name: 'Right', move: moveFunction(1, 0)})
const Directions = Object.freeze([Up, Down, Left, Right])

function setup() {
    const directionQueue = []
    const snakeBoard = document.getElementById('snake-board')
    const canvas = document.getElementById("snake-board");
    snakeBoard.style.background = 'yellow'
    const gc = snakeBoard.getContext('2d')
    let x= 0
    let y = 0
    let currentDirection = Right
    window.onkeydown = event => {
        for (let direction of Directions) {
            if (event.code === direction.keyCode) {
                directionQueue.push(direction)
            }
        }
    }
    const interval = setInterval(move, 100)
    function move() {
        while (directionQueue.length > 0) {
            let newDirection = directionQueue.shift()
            if (directionApplicable(newDirection)) {
                currentDirection = newDirection
                break
            }
        }
        [x, y] = currentDirection.move(x, y)
        gc.fillStyle = 'black'
        gc.fillRect(x * 10, y * 10, 10, 10)
    }
    function directionApplicable(direction) {
        switch (currentDirection) {
            case Up:
            case Down:
                return direction === Left || direction === Right
            case Left:
            case Right:
                return direction === Up || direction === Down
            default:
                throw RangeError()
        }
    }
}

function moveFunction(dx, dy) {
    return (x, y) => [x + dx, y + dy]
}