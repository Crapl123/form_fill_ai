"use client";

import React, { useEffect, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import ExcelJS from "exceljs";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CloudUpload,
  FileCheck,
  Loader,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  Database,
  HelpCircle,
} from "lucide-react";
import { processForm } from "./actions";
import { useToast } from "@/hooks/use-toast";

const initialState = {
  status: "idle" as "idle" | "success" | "error" | "processing" | "awaiting-input",
  message: "",
  fileData: null,
  fileName: "",
  mimeType: "",
  missingFields: undefined,
};

const FileUploadDropzone = ({ file, onFileChange, icon, title, description, inputId, ...props }) => {
  return (
    <label htmlFor={inputId} className="cursor-pointer">
      <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed p-10 text-center transition hover:border-primary">
        {file ? (
          <>
            <FileCheck className="h-10 w-10 text-green-500" />
            <p className="font-semibold">{file.name}</p>
            <p className="text-xs text-muted-foreground">Click or drag to change file</p>
          </>
        ) : (
          <>
            {icon}
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </div>
      <Input
        id={inputId}
        name={inputId}
        type="file"
        className="sr-only"
        onChange={onFileChange}
        accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        {...props}
      />
    </label>
  )
}


export default function Home() {
  const { toast } = useToast();
  const [state, formAction] = useActionState(processForm, initialState);
  const { pending } = useFormStatus();

  const [currentTab, setCurrentTab] = useState("master-data");
  
  const [masterData, setMasterData] = useState<Record<string, string> | null>(null);
  const [masterDataFile, setMasterDataFile] = useState<File | null>(null);
  const [masterDataStatus, setMasterDataStatus] = useState<"idle" | "parsing" | "success" | "error">("idle");

  const [vendorFormFile, setVendorFormFile] = useState<File | null>(null);
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
        variant: "default",
        title: "Processing Complete!",
        description: "Your file is ready for download.",
      });
    }
  }, [state, toast]);
  
  const handleMasterDataFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      if (selectedFile && selectedFile.name.endsWith(".xlsx")) {
        setMasterDataFile(selectedFile);
        setMasterData(null);
        setMasterDataStatus("idle");
      } else {
        setMasterDataFile(null);
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a valid .xlsx Excel file.",
        });
      }
    }
  };
  
  const handleVendorFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      if (selectedFile && selectedFile.name.endsWith(".xlsx")) {
        setVendorFormFile(selectedFile);
        setDownloadUrl(null);
        // Reset state if a new file is uploaded
        if (state.status !== "idle") {
           // This is a bit of a hack, we should ideally have a separate reset action
           initialState.status = "idle";
           initialState.message = "";
        }
      } else {
        setVendorFormFile(null);
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a valid .xlsx Excel file.",
        });
      }
    }
  };

  const handleMasterDataParse = async () => {
    if (!masterDataFile) {
      toast({ variant: "destructive", title: "No file selected", description: "Please select your master data file." });
      return;
    }
    setMasterDataStatus('parsing');
    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await masterDataFile.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("No worksheet found in the file.");
      }
      const data: Record<string, string> = {};
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const keyCell = row.getCell(1);
        const valueCell = row.getCell(2);
        const key = keyCell.text.trim();
        if (key) {
          data[key] = valueCell.text.trim();
        }
      });

      if(Object.keys(data).length === 0) {
        throw new Error("Could not parse any data. Ensure the first column has keys and the second has values.");
      }

      setMasterData(data);
      setMasterDataStatus('success');
      toast({ variant: "default", title: "Master data parsed!", description: "You can now proceed to step 2." });
      setCurrentTab("fill-form");
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during parsing.";
      setMasterDataStatus('error');
      setMasterData(null);
      toast({ variant: "destructive", title: "Parsing Failed", description: message });
    }
  };


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">Form AutoFill AI</CardTitle>
          <CardDescription className="text-base">
            Instantly fill any Excel form from your master data sheet in two simple steps.
          </CardDescription>
        </CardHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="master-data">Step 1: Upload Master Data</TabsTrigger>
            <TabsTrigger value="fill-form" disabled={!masterData}>Step 2: Fill Form</TabsTrigger>
          </TabsList>

          <TabsContent value="master-data">
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm text-center text-muted-foreground">Upload an .xlsx file with your master data. The first column (A) should be the field name, and the second (B) should be the value.</p>
              <FileUploadDropzone
                file={masterDataFile}
                onFileChange={handleMasterDataFileChange}
                icon={<Database className="h-10 w-10 text-muted-foreground" />}
                title="Upload Master Data Sheet"
                description="Excel files only (.xlsx)"
                inputId="master-data-upload"
              />
               {masterDataStatus === "error" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Parsing Error</AlertTitle>
                  <AlertDescription>Could not parse master data. Please check the file format and try again.</AlertDescription>
                </Alert>
              )}
               {masterDataStatus === "success" && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{Object.keys(masterData || {}).length} records loaded. Ready for Step 2.</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleMasterDataParse} disabled={!masterDataFile || masterDataStatus === 'parsing'} className="w-full" size="lg">
                {masterDataStatus === 'parsing' ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Parsing...</> : "Parse & Continue"}
              </Button>
            </CardFooter>
          </TabsContent>

          <TabsContent value="fill-form">
            <form action={formAction}>
              <CardContent className="space-y-6 pt-6">
                 {state.status === 'awaiting-input' ? (
                   <div className="space-y-4">
                    <Alert>
                      <HelpCircle className="h-4 w-4" />
                      <AlertTitle>Missing Information</AlertTitle>
                      <AlertDescription>{state.message}</AlertDescription>
                    </Alert>
                    <input type="hidden" name="is-second-step" value="true" />
                     <div className="space-y-4 rounded-md border p-4">
                       {state.missingFields?.map((field) => (
                         <div key={field} className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor={field} className="text-right">{field}</Label>
                            <Input id={field} name={field} className="col-span-2" required />
                         </div>
                       ))}
                     </div>
                   </div>
                 ) : (
                  <>
                    <input type="hidden" name="masterData" value={JSON.stringify(masterData ?? {})} />
                    <FileUploadDropzone
                        file={vendorFormFile}
                        onFileChange={handleVendorFormFileChange}
                        icon={<CloudUpload className="h-10 w-10 text-muted-foreground" />}
                        title="Upload Vendor Form"
                        description="Excel files only (.xlsx)"
                        inputId="file"
                        name="file"
                        required
                    />
                  </>
                 )}
                
                {pending && (
                  <div className="space-y-4 rounded-md border p-4">
                     <div className="flex items-center gap-3 text-primary">
                        <Loader className="h-5 w-5 animate-spin text-accent" />
                        <span className="font-medium">Processing your form with AI...</span>
                     </div>
                  </div>
                )}
                
                {state.status === "error" && state.message && (
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
                    <Button className="w-full" size="lg" variant="default" type="button">
                      <Download className="mr-2 h-4 w-4" />
                      Download Filled Form
                    </Button>
                  </a>
                ) : (
                   <Button type="submit" disabled={pending} className="w-full" size="lg">
                    {pending ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : state.status === 'awaiting-input' ? (
                       <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Submit & Complete
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Auto-Fill Form
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </main>
  );
}
