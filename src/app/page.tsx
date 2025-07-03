"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CloudUpload,
  FileCheck,
  Loader,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { processForm } from "./actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const initialState = {
  status: "idle",
  message: "",
  fileData: null,
  fileName: "",
  mimeType: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full" size="lg">
      {pending ? (
        <>
          <Loader className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Zap className="mr-2 h-4 w-4" />
          Auto-Fill Form
        </>
      )}
    </Button>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [state, formAction] = useFormState(processForm, initialState);
  const [file, setFile] = useState<File | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "error") {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: state.message,
      });
    }

    if (state.status === "success" && state.fileData && state.mimeType) {
      const byteCharacters = atob(state.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: state.mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      toast({
        title: "Processing Complete!",
        description: "Your file is ready for download.",
        variant: "default",
      });
    }
  }, [state, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      if (
        selectedFile &&
        (selectedFile.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          selectedFile.name.endsWith(".xlsx"))
      ) {
        setFile(selectedFile);
        // Reset state on new file selection
        setDownloadUrl(null);
        state.status = "idle";
        state.message = "";
      } else {
        setFile(null);
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a valid .xlsx Excel file.",
        });
      }
    }
  };

  const StatusItem = ({ icon, text, isCompleted, isActive, isError }) => (
    <div className={cn("flex items-center gap-3 transition-all", isCompleted ? "text-primary" : "text-muted-foreground")}>
      <div className={cn("rounded-full p-1.5", 
        isCompleted && !isError && "bg-primary/10",
        isActive && "bg-accent/20",
        isError && "bg-destructive/10"
      )}>
        {isActive ? <Loader className="h-5 w-5 animate-spin text-accent" /> :
         isError ? <XCircle className="h-5 w-5 text-destructive" /> :
         isCompleted ? <CheckCircle2 className="h-5 w-5 text-primary" /> :
         React.cloneElement(icon, { className: "h-5 w-5" })
        }
      </div>
      <span className={cn("font-medium", isActive && "text-accent-foreground")}>{text}</span>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">Form AutoFill AI</CardTitle>
          <CardDescription className="text-base">
            Upload a vendor form, and let AI fill it instantly from your master data.
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="space-y-6">
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed p-10 text-center transition hover:border-primary">
                {file ? (
                  <>
                    <FileCheck className="h-10 w-10 text-green-500" />
                    <p className="font-semibold text-primary-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">Click or drag to change file</p>
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-semibold">Click to upload or drag & drop</p>
                    <p className="text-xs text-muted-foreground">Excel files only (.xlsx)</p>
                  </>
                )}
              </div>
              <Input
                id="file-upload"
                name="file"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
              />
            </label>
            
            {(state.status !== 'idle' && state.status !== 'success') || (useFormStatus().pending) && (
              <div className="space-y-4 rounded-md border p-4">
                <StatusItem icon={<Zap />} text="Processing Started" isCompleted={useFormStatus().pending || state.status !== 'idle'} isActive={useFormStatus().pending} />
              </div>
            )}
            
            {state.status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download={state.fileName}
                className="w-full"
              >
                <Button className="w-full" size="lg" variant="default">
                  <Download className="mr-2 h-4 w-4" />
                  Download Filled Form
                </Button>
              </a>
            ) : (
              <SubmitButton />
            )}
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
