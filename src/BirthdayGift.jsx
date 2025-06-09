import { useState, useRef, useCallback, useEffect, memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import Lottie from "lottie-react";
import flameAnimation from "./flame.json"; // Make sure this path is correct
import hearts from "./hearts.svg"; // Make sure this path is correct

const NUM_CANDLES = 3;
const CONFETTI_BASE_OPTIONS = {
  particleCount: 120,
  spread: 90,
  origin: { y: 0.6 },
};

const CAKE_BOX_H_REM_VAL = 18;
const TOP_LAYER_BOTTOM_REM_VAL = 8;
const TOP_LAYER_H_REM_VAL = 2;
const CANDLE_STICK_H_REM_VAL = 1.5;

const topCakeSurfaceFromBoxTopRem =
  CAKE_BOX_H_REM_VAL - (TOP_LAYER_BOTTOM_REM_VAL + TOP_LAYER_H_REM_VAL);
const candleGroupTopRem = topCakeSurfaceFromBoxTopRem - CANDLE_STICK_H_REM_VAL;

const cakeLayersData = [
  { bottom: "4rem", width: "w-48", bgColor: "bg-pink-500", delay: 0 },
  { bottom: "6rem", width: "w-40", bgColor: "bg-pink-400", delay: 0.2 },
  { bottom: "8rem", width: "w-32", bgColor: "bg-pink-300", delay: 0.4 },
];

const songList = ["/hbd.m4a"]; // Ensure this is in your public folder

const CakeLayer = memo(({ bottom, width, bgColor, delay, shouldReduceMotion }) => (
  <motion.div
    initial={{ y: -50, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={
      shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 150, damping: 20, delay }
    }
    className={`absolute left-1/2 -translate-x-1/2 h-8 ${width} ${bgColor} rounded-t-xl`}
    style={{ bottom }}
  />
));
CakeLayer.displayName = "CakeLayer";

const Candle = memo(({ blown, shouldReduceMotion }) => (
  <div className="flex flex-col items-center">
    <div className="w-1 h-6 bg-yellow-300 rounded-sm"></div> {/* Candle stick */}
    <div className="w-6 h-9 -mt-[3.1rem]"> {/* Flame container */}
      {!blown && (
        <Lottie
          animationData={flameAnimation}
          loop
          autoPlay={!shouldReduceMotion}
          className="w-full h-full"
        />
      )}
    </div>
  </div>
));
Candle.displayName = "Candle";

export default function BirthdayGift() {
  const [candlesBlown, setCandlesBlown] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [gainNode, setGainNode] = useState(null);

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const audioSourceRef = useRef(null); // To store the MediaElementAudioSourceNode
  const shouldReduceMotion = useReducedMotion();

  // Effect to initialize AudioContext and GainNode
  useEffect(() => {
    // Check if AudioContext is supported
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
        console.warn("Web Audio API is not supported in this browser.");
        return;
    }
    const context = new AudioContext();
    const gain = context.createGain();
    gain.connect(context.destination); // Connect gain to destination ONCE

    setAudioContext(context);
    setGainNode(gain);

    // Cleanup on component unmount
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
      }
      gain.disconnect();
      context.close().catch(err => console.error("Error closing AudioContext:", err));
      audioSourceRef.current = null; // Reset ref
    };
  }, []); // Runs once on mount

  // Effect to create and connect MediaElementAudioSourceNode
  // This runs after audioContext, gainNode, and audioRef.current are available
  useEffect(() => {
    if (audioContext && gainNode && audioRef.current && !audioSourceRef.current) {
      try {
        const source = audioContext.createMediaElementSource(audioRef.current);
        source.connect(gainNode);
        audioSourceRef.current = source; // Store the source node
      } catch (err) {
        // This might happen if audioRef.current is not a valid media element yet,
        // or if createMediaElementSource was somehow called before.
        console.error("Error creating media element source:", err);
      }
    }
    // Dependencies: re-run if these change.
    // audioRef.current is technically mutable and not ideal in deps, but for DOM refs,
    // it's usually stable after initial render.
    // If audioRef could point to different <audio> elements, this might need adjustment.
  }, [audioContext, gainNode, audioRef]);


  const fireConfetti = useCallback(() => {
    if (shouldReduceMotion) return;
    confetti(CONFETTI_BASE_OPTIONS);
    confetti({ ...CONFETTI_BASE_OPTIONS, spread: 70, origin: { x: 0.3, y: 0.6 } });
    confetti({ ...CONFETTI_BASE_OPTIONS, spread: 70, origin: { x: 0.7, y: 0.6 } });
  }, [shouldReduceMotion]);

  const handleBlowCandles = useCallback(async () => {
    setCandlesBlown(true);
    fireConfetti();

    if (audioRef.current && audioContext && gainNode && !musicPlaying) {
      // Resume AudioContext if it's suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
        } catch (err) {
          console.error("Error resuming AudioContext:", err);
          return; // Can't play audio if context can't be resumed
        }
      }

      // Check if audio source is initialized
      if (!audioSourceRef.current) {
        console.warn("Audio source not yet initialized for handleBlowCandles. Attempting to create.");
        // Fallback attempt (should ideally be handled by the useEffect)
        try {
          const source = audioContext.createMediaElementSource(audioRef.current);
          source.connect(gainNode);
          audioSourceRef.current = source;
        } catch (e) {
          console.error("Fallback audio source creation failed in blow candles:", e);
          // If it's InvalidStateError, it means it was created elsewhere, which is good.
          if (e.name !== "InvalidStateError") return; // Don't proceed if failed for other reasons
        }
      }

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 2);

      try {
        await audioRef.current.play();
        setMusicPlaying(true);
      } catch (err) {
        console.error("Audio play error in handleBlowCandles:", err);
      }
    }
  }, [fireConfetti, audioContext, gainNode, musicPlaying, shouldReduceMotion]);

  const toggleMusic = useCallback(async () => {
    if (!audioRef.current || !audioContext || !gainNode) {
        console.warn("Audio components not ready for toggleMusic");
        return;
    }

    // Resume AudioContext if it's suspended
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (err) {
        console.error("Error resuming AudioContext:", err);
        return;
      }
    }

    // Check if audio source is initialized
    if (!audioSourceRef.current) {
        console.warn("Audio source not yet initialized for toggleMusic. Attempting to create.");
        // Fallback attempt
        try {
          const source = audioContext.createMediaElementSource(audioRef.current);
          source.connect(gainNode);
          audioSourceRef.current = source;
        } catch (e) {
          console.error("Fallback audio source creation failed in toggle music:", e);
          if (e.name !== "InvalidStateError") return;
        }
    }

    if (musicPlaying) {
      audioRef.current.pause();
    } else {
      // If gain was 0 (e.g. after fading out), set it back to 1
      // Check for a very small value due to float precision
      if (gainNode.gain.value < 0.01) {
        gainNode.gain.setValueAtTime(1, audioContext.currentTime);
      }
      try {
        await audioRef.current.play();
      } catch (err) {
        console.error("Audio play error in toggleMusic:", err);
      }
    }
    setMusicPlaying(!musicPlaying);
  }, [musicPlaying, audioContext, gainNode]);

  const handlePlaySurprise = useCallback(() => {
    setShowVideo(true);
    setVideoLoading(true);
  }, []);

  const handleVideoCanPlay = useCallback(() => {
    setVideoLoading(false);
    if (videoRef.current) {
        videoRef.current.play().catch(err => console.error("Video autoplay error:", err));
    }
  }, []);

  const handleVideoError = useCallback(() => {
    setVideoLoading(false);
    console.error("Video failed to load");
    // Optionally, show an error message to the user
  }, []);

  // Preload audio metadata to enable AudioContext connection
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load(); // Or set preload="metadata" on the <audio> tag
    }
  }, []);


  return (
    <main className="min-h-screen w-screen bg-gradient-to-b from-pink-100 via-pink-200 to-pink-100 text-center p-4 relative overflow-hidden flex flex-col items-center justify-start">
      
      <audio
        ref={audioRef}
        src={songList[0]}
        loop
        crossOrigin="anonymous"
        preload="metadata" // Helps ensure the element is ready for AudioContext
      />

      <motion.h1
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 1 }}
        className="relative text-4xl font-bold text-pink-700 mb-4 z-10"
      >
        🎉 Happy Birthday, My Love! 🎉
      </motion.h1>

      <div className="absolute top-5 right-4 flex gap-1 z-20">
        <button
          onClick={toggleMusic}
          className="w-10 h-10 bg-yellow-400 text-white rounded-full flex items-center justify-center hover:bg-yellow-500 transition focus:outline-none focus:ring-2 focus:ring-yellow-600"
          aria-pressed={musicPlaying}
          title={musicPlaying ? "Pause Music" : "Play Music"}
          disabled={!audioContext || !gainNode} // Disable if audio setup not complete
        >
          {musicPlaying ? "🎵" : "🎶"}
        </button>
      </div>

      <div
        className="relative w-full max-w-md mx-auto p-4 bg-white rounded-xl shadow-xl mt-8 z-10"
        style={{ height: `${CAKE_BOX_H_REM_VAL}rem` }}
      >
        <img
          src={hearts} // Ensure this path is correct
          alt="decorative hearts on the left"
          className="absolute left-[-2rem] top-2/5 w-50 h-8 z-20 animate-bounce" // Adjusted w-50 to w-12 (3rem) as w-50 is very large
        />
        <img
          src={hearts} // Ensure this path is correct
          alt="decorative hearts on the right"
          className="absolute right-[-2rem] top-2/5 w-50 h-8 z-20 animate-bounce" // Adjusted w-50 to w-12
        />

        {cakeLayersData.map((layer) => (
          <CakeLayer
            key={layer.bgColor}
            bottom={layer.bottom}
            width={layer.width}
            bgColor={layer.bgColor}
            delay={layer.delay}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.7, duration: 0.5 }}
          className="absolute left-1/2 -translate-x-1/2 flex gap-2"
          style={{ top: `${candleGroupTopRem}rem` }}
        >
          {[...Array(NUM_CANDLES)].map((_, i) => (
            <Candle key={i} blown={candlesBlown} shouldReduceMotion={shouldReduceMotion} />
          ))}
        </motion.div>

        {!candlesBlown ? (
          <button
            className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-4 py-2 rounded hover:bg-pink-600 transition focus:outline-none focus:ring-2 focus:ring-pink-700"
            onClick={handleBlowCandles}
            disabled={!audioContext || !gainNode} // Disable if audio setup not complete
          >
            Blow Out Candles 🎂
          </button>
        ) : (
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-pink-600 font-semibold">
            ✨ You blew the candles! Make a wish 💖
          </p>
        )}
      </div>

      <motion.div
        className="mt-12 text-xl text-pink-800 z-10 relative"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 1, delay: 0.5 }}
      >
        <p>
          "You are the light in my life, and I’m so grateful to celebrate your
          special day. Here’s to us and many more memories together."
        </p>
      </motion.div>

      <div className="mt-12 z-10 relative">
        <h2 className="text-2xl font-bold text-pink-700 mb-2">📸 Our Memories</h2>
        <p className="text-pink-600">(Coming soon: photo carousel)</p>
      </div>

      <div className="mt-12 z-10 relative mb-8"> {/* Added mb-8 for some bottom spacing */}
        {!showVideo ? (
          <button
            onClick={handlePlaySurprise}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition focus:outline-none focus:ring-2 focus:ring-purple-800"
          >
            Play My Surprise 🎥
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 1 }}
            className="max-w-lg mx-auto w-full" // Added w-full for better responsiveness
          >
            {videoLoading && <p className="text-purple-700">Loading video...</p>}
            <video
              ref={videoRef}
              controls
              className="rounded-xl shadow-lg mt-4 w-full"
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
              onLoadedData={() => setVideoLoading(false)} // More reliable than onCanPlay for hiding loader
              style={{ display: videoLoading ? "none" : "block" }} // Keep for initial hide
              src="/your-video.mp4" // Ensure this is in your public folder
              playsInline // Good for mobile
            >
              {/* <source src="/your-video.mp4" type="video/mp4" /> // Not needed if src is on video tag */}
              Your browser does not support the video tag.
            </video>
          </motion.div>
        )}
      </div>
    </main>
  );
}