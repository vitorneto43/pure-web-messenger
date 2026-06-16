import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  TrackRefContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

interface Props {
  token: string;
  serverUrl: string;
  publish: boolean;
  onLeave?: () => void;
  children?: React.ReactNode;
}

function VideoStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  if (!tracks.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Aguardando a transmissão começar…
      </div>
    );
  }
  return (
    <GridLayout tracks={tracks} className="h-full">
      <TrackRefContext.Consumer>
        {() => <ParticipantTile />}
      </TrackRefContext.Consumer>
    </GridLayout>
  );
}

export function LiveRoomShell({ token, serverUrl, publish, onLeave, children }: Props) {
  // Capacitor/iOS sometimes blocks audio playback until user gesture; mounted state ensures we render after.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video={publish}
      audio={publish}
      onDisconnected={onLeave}
      data-lk-theme="default"
      style={{ height: "100%", width: "100%" }}
    >
      <div className="relative w-full h-full bg-black">
        <VideoStage />
        <RoomAudioRenderer />
        {children}
      </div>
    </LiveKitRoom>
  );
}
