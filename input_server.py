from flask import Flask, Response
from flask_cors import CORS
import datetime
from blessed import Terminal
import keyboard
import mouse


# --- Blessed 터미널 초기화 ---
term = Terminal()
app = Flask(__name__)
CORS(app)

host = '0.0.0.0'
port = 8000

def log_msg(category, message, color):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    # 카테고리별로 색상을 다르게 적용
    cat_text = color(f"{category:10}")
    print(f"{term.white_bold(f'[{timestamp}]')} {cat_text} {term.white('|')} {message}")

# MANDLOH ASCII 배너 (해커 테마)
BANNER = f"""
{term.bright_cyan(term.bold(r"""
  ███╗   ███╗ █████╗ ███╗   ██╗██████╗ ██╗      ██████╗ ██╗  ██╗
  ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██║     ██╔═══██╗██║  ██║
  ██╔████╔██║███████║██╔██╗ ██║██║  ██║██║     ██║   ██║███████║
  ██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║██║     ██║   ██║██╔══██║
  ██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝███████╗╚██████╔╝██║  ██║
  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═╝"""))}
          {term.on_color(4)(term.white_bold("  [ MANDLOH INPUT SERVER ]  "))}
"""

print(term.clear) # 실행 시 화면 초기화
print(BANNER)
log_msg("SYSTEM", "Server start.", term.bright_magenta)
log_msg("SYSTEM", f"Input URL : http://{host}:{port}", term.bright_magenta)


@app.route('/<cmd>')
def get_input(cmd):
    # 입력 커맨드는 가시성을 위해 배경색 추가
    log_msg("INPUT", term.bold(f" {cmd} "), term.bright_yellow)

    if cmd == 'check':
        return "ok"
    else:
        if ',' in cmd:
            x, y = map(int, cmd.split(','))
            mouse.move(x, y, duration=0.05)
            mouse.click()
        else:
            keyboard.write(cmd)

    return Response(status=204)


if __name__ == '__main__':
    # Flask 로그 억제 (중요)
    import logging
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    
    try:
        app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        print(f"\n{term.bright_red('Stopping server...')}")