"use client";
import { MENU_ITEMS } from "@/constants";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { activeMenuItemState, actionItemClick } from "@/store/menu/menuSlice";
import { useEffect, useRef, useLayoutEffect } from "react";
import { socket } from "@/socket";

const Board = () => {
  const dispatch = useAppDispatch();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawHistoryRef = useRef<any[]>([]);
  const historyPointerRef = useRef<number>(0);
  const shouldDrawRef = useRef<boolean>(false);

  const { activeMenuItem, actionMenuItem } =
    useAppSelector(activeMenuItemState);
  const { color, size } = useAppSelector(
    (state) => state.toolbar[activeMenuItem]
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (actionMenuItem === MENU_ITEMS.DOWNLOAD) {
      const URL = canvas.toDataURL();
      const anchor = document.createElement("a");
      anchor.href = URL;
      anchor.download = "sketch.png";
      anchor.click();
    } else if (
      actionMenuItem === MENU_ITEMS.UNDO ||
      actionMenuItem === MENU_ITEMS.REDO
    ) {
      if (historyPointerRef.current > 0 && actionMenuItem === MENU_ITEMS.UNDO)
        historyPointerRef.current -= 1;
      if (
        historyPointerRef.current < drawHistoryRef.current.length - 1 &&
        actionMenuItem === MENU_ITEMS.REDO
      )
        historyPointerRef.current += 1;
      const imageData = drawHistoryRef.current[historyPointerRef.current];
      context?.putImageData(imageData, 0, 0);
    }
    dispatch(actionItemClick(null));
  }, [actionMenuItem, dispatch]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const changeConfig = (
      color: string | undefined,
      size: number | undefined
    ) => {
      if (context) {
        context.strokeStyle = color ? color : "black";
        context.lineWidth = size ? size : 2;
      }
    };
    const handleChangeConfig = (config: { color: string; size: number }) => {
      changeConfig(config.color, config.size);
    };
    changeConfig(color, size);
    socket.on("changeConfig", handleChangeConfig);

    return () => {
      socket.off("changeConfig", handleChangeConfig);
    };
  }, [color, size]);
  //before browser paint
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const beginPath = (x: number, y: number) => {
      context?.beginPath();
      context?.moveTo(x, y);
    };

    const drawPath = (x: number, y: number) => {
      context?.lineTo(x, y);
      context?.stroke();
    };

    const handleMouseDown = (e: any) => {
      shouldDrawRef.current = true;
      beginPath(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY)
      socket.emit('beginPath', {x: e.clientX || e.touches[0].clientX, y: e.clientY || e.touches[0].clientY})
    };

    const handleMouseMove = (e: any) => {
      if (!shouldDrawRef.current) return;
      drawPath(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY)
      socket.emit("drawLine", {x: e.clientX || e.touches[0].clientX, y: e.clientY || e.touches[0].clientY})
    };

    const handleMouseUp = (e: any) => {
      shouldDrawRef.current = false;
      const imageData = context?.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );
      if (imageData) {
        drawHistoryRef.current.push(imageData);
        historyPointerRef.current = drawHistoryRef.current.length - 1;
      }
    };

    const handleBeginPath = (path: any) => {
      beginPath(path?.x, path?.y);
    };

    const handleDrawLine = (path: any) => {
      drawPath(path?.x, path?.y);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);

    canvas.addEventListener("touchstart", handleMouseDown);
    canvas.addEventListener("touchmove", handleMouseMove);
    canvas.addEventListener("touchend", handleMouseUp);

    socket.on("beginPath", handleBeginPath);
    socket.on("drawLine", handleDrawLine);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("touchstart", handleMouseDown);
      canvas.removeEventListener("touchmove", handleMouseMove);
      canvas.removeEventListener("touchend", handleMouseUp);
      socket.off("beginPath", handleBeginPath);
      socket.off("drawLine", handleDrawLine);
    };
  }, []);
  return <canvas ref={canvasRef}></canvas>;
};

export default Board;
