# app/core/discord_bot.py

import discord
from discord.ext import commands, tasks
import asyncio
import logging
import os
from app.core.bridge import command_queue

log = logging.getLogger("DiscordBot")

# --- Configuración de Intents del Bot ---
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True  # necesario para manejar canales de voz


class AeryuBot(commands.Bot):
    # El bot ahora recibe también el server_id en su constructor
    def __init__(self, command_queue, media_folder, server_id):
        super().__init__(command_prefix="!", intents=intents)
        self.command_queue = command_queue
        self.media_folder = media_folder
        # ✅ FIX: convertimos siempre a int si viene un valor, da igual si es str o int
        self.target_server_id = int(server_id) if server_id else None
        self.guild = None
        self.current_vc = None
        self.current_source = None
        self.volume_level = 1.0  # volumen por defecto (100%)

    async def on_ready(self):
        """Cuando el bot arranca y se conecta a Discord"""
        log.info(f"Bot de Discord conectado como {self.user}")

        if not self.target_server_id:
            log.error("No se ha proporcionado un ID de servidor. El bot no sabrá dónde operar.")
            return

        # Buscamos el servidor en Discord con el ID dado
        self.guild = self.get_guild(self.target_server_id)
        if not self.guild:
            log.error(f"No se pudo encontrar el servidor con ID {self.target_server_id}.")
        else:
            log.info(f"Bot operando en el servidor: {self.guild.name}")

        # Arrancamos la tarea que revisa la cola de órdenes desde la web
        self.check_command_queue.start()

    # --- Loop que escucha la cola de comandos ---
    @tasks.loop(seconds=0.1)
    async def check_command_queue(self):
        """Revisa continuamente la cola de comandos que llegan desde la API Flask"""
        if not self.command_queue.empty():
            command = self.command_queue.get()
            action = command.get("action")
            log.info(f"Recibida nueva orden desde la web: {action}")

            if action == "connect":
                await self.connect_to_voice(command.get("state"))
            elif action == "disconnect":
                await self.disconnect_from_voice()
            elif action == "play":
                song_data = command.get("song")
                if song_data:
                    await self.play_song(song_data)
            elif action == "pause":
                await self.pause_playback()
            elif action == "resume":
                await self.resume_playback()
            elif action == "volume":
                await self.set_bot_volume(command.get("value"))

    # --- Reproducción de audio ---
    async def play_song(self, song, start_time=0):
        """Reproduce una canción en el canal de voz actual"""
        if not self.current_vc or not self.current_vc.is_connected():
            return
        if self.current_vc.is_playing():
            self.current_vc.stop()

        file_path = os.path.join(self.media_folder, song['file_basename'])
        if not os.path.exists(file_path):
            log.error(f"No se encuentra el archivo de audio: {file_path}")
            return

        try:
            ffmpeg_options = f"-ss {start_time}"
            source = discord.PCMVolumeTransformer(
                discord.FFmpegPCMAudio(file_path, options=ffmpeg_options)
            )
            source.volume = self.volume_level
            self.current_source = source
            self.current_vc.play(self.current_source)

            log.info(f"Reproduciendo en Discord: {song['title']} desde {int(start_time)}s")

            # mostramos el estado "escuchando..."
            activity = discord.Activity(
                type=discord.ActivityType.listening,
                name=f"{song.get('title', 'una canción')} - {song.get('artist', 'artista desconocido')}"
            )
            await self.change_presence(activity=activity)

        except Exception as e:
            log.error(f"Error al reproducir audio con FFmpeg: {e}")

    async def pause_playback(self):
        """Pausar la reproducción en Discord"""
        if self.current_vc and self.current_vc.is_playing():
            self.current_vc.pause()
            await self.change_presence(activity=None)  # limpiamos el estado

    async def resume_playback(self):
        """Reanudar la reproducción en Discord"""
        if self.current_vc and self.current_vc.is_paused():
            self.current_vc.resume()

    async def set_bot_volume(self, volume_level):
        """Ajustar el volumen de reproducción"""
        self.volume_level = max(0.0, min(2.0, volume_level))  # entre 0% y 200%
        if self.current_source:
            self.current_source.volume = self.volume_level

    async def connect_to_voice(self, state=None):
        """Conectar al primer canal de voz con usuarios"""
        if not self.guild:
            log.warning("No se puede conectar: guild no encontrada.")
            return

        target_channel = None
        for channel in self.guild.voice_channels:
            if len(channel.members) > 0:
                target_channel = channel
                break

        if not target_channel:
            return

        if self.current_vc and self.current_vc.is_connected():
            await self.current_vc.move_to(target_channel)
        else:
            try:
                self.current_vc = await target_channel.connect(timeout=20.0, reconnect=True)
                if state and state.get("song"):
                    await self.play_song(state["song"], start_time=state.get("progress", 0))
            except Exception as e:
                log.error(f"Error al conectar al canal de voz: {e}")

    async def disconnect_from_voice(self):
        """Desconectar del canal de voz"""
        if self.current_vc and self.current_vc.is_connected():
            await self.current_vc.disconnect()
            self.current_vc = None
            await self.change_presence(activity=None)  # limpiamos estado


# --- Arranque del bot ---
async def run_bot(token, queue, media_folder, server_id):
    """Función principal para iniciar el bot"""
    bot = AeryuBot(queue, media_folder, server_id)
    await bot.start(token)
