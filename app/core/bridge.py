# app/core/bridge.py

from queue import Queue

# Creamos una cola de comandos que será compartida entre la aplicación web y el bot.
# Es como un buzón: la web pone "cartas" (órdenes) y el bot las recoge para leerlas.
command_queue = Queue()