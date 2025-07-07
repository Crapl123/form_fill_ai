"use client";

import React, { useEffect, useState, useActionState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import { useAuth } from "@/context/AuthContext";
import { getMasterData, saveMasterData } from "@/lib/firestore";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ListChecks,
  ArrowRight,
  Wand2,
  FileEdit,
  RefreshCw,
  HelpCircle,
  BookUp,
  LogOut,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { processForm, applyCorrections, FormState } from "./actions";
import { useToast } from "@/hooks/use-toast";

const initialProcessState: FormState = {
  status: "idle",
  message: "",
  fileData: null,
  fileName: "",
  mimeType: "",
  debugInfo: undefined,
  previewData: [],
  missingFields: [],
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
        accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .pdf, application/pdf"
        {...props}
      />
    </label>
  )
}

function CorrectionForm({ processState, masterData, onMasterDataUpdate }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [correctionState, correctionAction, isSubmittingCorrections] = useActionState(applyCorrections, initialProcessState);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [updatedMasterDataUrl, setUpdatedMasterDataUrl] = useState<string | null>(null);

  const uniqueMissingFields = useMemo(() => {
    if (!processState.missingFields) return [];
    const seen = new Set();
    return processState.missingFields.filter(item => {
      const duplicate = seen.has(item.targetCell);
      seen.add(item.targetCell);
      return !duplicate;
    });
  }, [processState.missingFields]);

  useEffect(() => {
    if (correctionState.status === "error") {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: correctionState.message,
      });
    }

    if (correctionState.status === "success" && correctionState.fileData && correctionState.mimeType) {
      toast({
        variant: "default",
        title: "Success!",
        description: "Your files are ready for download.",
      });
      
      const createUrl = (fileData: string, mimeType: string) => {
        const byteCharacters = atob(fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
      }

      setDownloadUrl(createUrl(correctionState.fileData, correctionState.mimeType));
      
      if (correctionState.updatedMasterData) {
        setUpdatedMasterDataUrl(createUrl(correctionState.updatedMasterData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
      }

      if (correctionState.updatedMasterDataJSON && user) {
        onMasterDataUpdate(correctionState.updatedMasterDataJSON);
        saveMasterData(user.uid, correctionState.updatedMasterDataJSON);
        toast({
          variant: "default",
          title: "Master Data Updated",
          description: "Your data has been saved for future use.",
        });
      }
    }
  }, [correctionState, toast, onMasterDataUpdate, user]);

  return (
    <form action={correctionAction} className="space-y-6">
      <input type="hidden" name="fileData" value={processState.fileData ?? ""} />
      <input type="hidden" name="fileName" value={processState.fileName ?? ""} />
      <input type="hidden" name="mimeType" value={processState.mimeType ?? ""} />
      <input type="hidden" name="masterData" value={JSON.stringify(masterData ?? {})} />
      <input type="hidden" name="missingFields" value={JSON.stringify(uniqueMissingFields ?? [])} />

      
      {uniqueMissingFields && uniqueMissingFields.length > 0 && (
          <div className="space-y-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex items-center gap-2">
                 <HelpCircle className="h-5 w-5 text-yellow-600" />
                 <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">Missing Information</h3>
              </div>
              <p className="text-sm text-muted-foreground">The AI identified these fields in the form but couldn't find matching data. Please provide the values below to improve future results.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {uniqueMissingFields.map(item => (
                    <div className="space-y-2" key={item.targetCell}>
                        <Label htmlFor={`missing_${item.targetCell}`}>{item.labelGuessed}</Label>
                        <Input 
                            id={`missing_${item.targetCell}`}
                            name={`missing_${item.targetCell}`}
                            placeholder={`Enter value for ${item.labelGuessed}...`}
                        />
                    </div>
                ))}
              </div>
          </div>
      )}

      <div>
          <h3 className="mb-2 font-semibold">Make Text-based Corrections (Optional)</h3>
          <Textarea
            name="correctionRequest"
            placeholder="e.g., Change the value in B5 to 'Completed'. Remove the value from C10."
            className="min-h-[100px]"
          />
      </div>

      {isSubmittingCorrections && (
        <Progress value={50} className="w-full" />
      )}

      {correctionState.status === "error" && correctionState.message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Correction Error</AlertTitle>
          <AlertDescription>{correctionState.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {downloadUrl ? (
          <div className="flex flex-col gap-2">
            <a href={downloadUrl} download={correctionState.fileName} className="w-full">
              <Button className="w-full" size="lg" variant="default" type="button">
                <Download className="mr-2 h-4 w-4" />
                Download Corrected Form
              </Button>
            </a>
            {updatedMasterDataUrl && (
                <a href={updatedMasterDataUrl} download={correctionState.updatedMasterDataFileName} className="w-full">
                    <Button className="w-full" size="lg" variant="secondary" type="button">
                    <BookUp className="mr-2 h-4 w-4" />
                    Download Updated Master Data
                    </Button>
                </a>
            )}
          </div>
        ) : (
          <Button type="submit" className="w-full" size="lg" disabled={isSubmittingCorrections}>
            {isSubmittingCorrections ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Applying Changes...</> : <><Wand2 className="mr-2 h-4 w-4" /> Apply Changes & Download</>}
          </Button>
        )}
      </div>
    </form>
  )
}

function InitialSetup({ onSetupComplete }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [masterDataFile, setMasterDataFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string> | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "saving">("idle");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      if (selectedFile && selectedFile.name.endsWith(".xlsx")) {
        setMasterDataFile(selectedFile);
        setParsedData(null);
        setStatus("idle");
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

  const handleParse = async () => {
    if (!masterDataFile) return;
    setStatus('parsing');
    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await masterDataFile.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheet found.");

      const data: Record<string, string> = {};
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const keyCell = row.getCell(1);
        const valueCell = row.getCell(2);
        const key = keyCell.text?.trim();
        if (key) {
          data[key] = valueCell.text?.trim() || "";
        }
      });

      if(Object.keys(data).length === 0) {
        throw new Error("Could not parse any data. Ensure the first column has keys and the second has values.");
      }
      setParsedData(data);
      setStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setStatus('idle');
      toast({ variant: "destructive", title: "Parsing Failed", description: message });
    }
  };

  const handleSave = async () => {
    if (!parsedData || !user) return;
    setStatus('saving');
    try {
      await saveMasterData(user.uid, parsedData);
      onSetupComplete(parsedData);
      toast({ title: "Success!", description: "Your master data has been saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setStatus('idle');
      toast({ variant: "destructive", title: "Save Failed", description: message });
    }
  };

  if (!parsedData) {
    return (
      <CardContent className="space-y-4 pt-6">
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>Welcome! Let's get started.</AlertTitle>
          <AlertDescription>
            Please upload your master data sheet to begin. This is a one-time setup. The file should be an .xlsx where column A is the field name and column B is the value.
          </AlertDescription>
        </Alert>
        <FileUploadDropzone
          file={masterDataFile}
          onFileChange={handleFileChange}
          icon={<Database className="h-10 w-10 text-muted-foreground" />}
          title="Upload Master Data Sheet"
          description="Excel files only (.xlsx)"
          inputId="master-data-upload"
        />
        <Button onClick={handleParse} disabled={!masterDataFile || status === 'parsing'} className="w-full" size="lg">
          {status === 'parsing' ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Parsing...</> : "Parse & Preview"}
        </Button>
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4 pt-6">
       <Alert>
          <ListChecks className="h-4 w-4" />
          <AlertTitle>Preview Your Data</AlertTitle>
          <AlertDescription>
            Review the parsed data below. If it's correct, save it to complete your setup.
          </AlertDescription>
        </Alert>
        <ScrollArea className="h-72 w-full rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Field Name</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.entries(parsedData).map(([key, value]) => (
                <TableRow key={key}><TableCell className="font-medium">{key}</TableCell><TableCell>{value}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <Button onClick={handleSave} disabled={status === 'saving'} className="w-full" size="lg">
          {status === 'saving' ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save and Continue"}
        </Button>
    </CardContent>
  );
}

function FormFiller({ masterData, onMasterDataUpdate }) {
  const { toast } = useToast();
  const [processState, processAction, isProcessing] = useActionState(processForm, initialProcessState);
  const [vendorFormFile, setVendorFormFile] = useState<File | null>(null);
  const [directDownloadUrl, setDirectDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (processState.status === "error") {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: processState.message,
      });
    }

    if (processState.status === "preview" && processState.fileData && processState.mimeType) {
      const byteCharacters = atob(processState.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: processState.mimeType });
      const url = URL.createObjectURL(blob);
      setDirectDownloadUrl(url); 
    }
  }, [processState, toast]);
  
  const handleVendorFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      const isValid = selectedFile && (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".pdf"));
      if (isValid) {
        setVendorFormFile(selectedFile);
        setDirectDownloadUrl(null);
        if (processState.status !== 'idle') {
          Object.assign(processState, initialProcessState);
        }
      } else {
        setVendorFormFile(null);
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a valid .xlsx or .pdf file.",
        });
      }
    }
  };

  const resetFormFill = () => {
      setVendorFormFile(null);
      setDirectDownloadUrl(null);
      Object.assign(processState, initialProcessState);
  }

  if (processState.status !== 'preview') {
    return (
      <form action={processAction}>
        <CardContent className="space-y-6 pt-6">
          <input type="hidden" name="masterData" value={JSON.stringify(masterData ?? {})} />
          <FileUploadDropzone
              file={vendorFormFile}
              onFileChange={handleVendorFormFileChange}
              icon={<CloudUpload className="h-10 w-10 text-muted-foreground" />}
              title="Upload Supplier Form To Fill"
              description="Excel or PDF files only (.xlsx, .pdf)"
              inputId="file"
              name="file"
              required
          />
          
          {isProcessing && (
            <div className="space-y-2">
               <div className="flex items-center gap-3 text-primary">
                  <Loader className="h-5 w-5 animate-spin text-accent" />
                  <span className="font-medium">AI is analyzing and filling your form...</span>
               </div>
               <Progress value={50} className="w-full" />
            </div>
          )}
          
          {processState.status === "error" && processState.message && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{processState.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isProcessing || !vendorFormFile} className="w-full" size="lg">
              {isProcessing ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><Zap className="mr-2 h-4 w-4" /> Auto-Fill Form</>}
          </Button>
        </CardFooter>
      </form>
    );
  }

  return (
    <CardContent className="space-y-4 pt-6">
      <Alert>
        <FileEdit className="h-4 w-4" />
        <AlertTitle>Preview, Fill & Correct</AlertTitle>
        <AlertDescription>
          The AI has filled what it can. Please provide any missing information and make corrections below.
        </AlertDescription>
      </Alert>

      {processState.mimeType === 'application/pdf' && processState.fileData ? (
        <div className="rounded-md border">
          <iframe
            src={`data:application/pdf;base64,${processState.fileData}`}
            className="h-[600px] w-full"
            title="PDF Preview"
          />
        </div>
      ) : (
        <div>
            <h3 className="mb-2 font-semibold">AI Auto-Filled Data</h3>
            <ScrollArea className="h-60 w-full rounded-md border">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Guessed Label</TableHead>
                    <TableHead>Cell Filled</TableHead>
                    <TableHead>Value Filled</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {processState.previewData?.length > 0 ? processState.previewData?.map((item) => (
                    <TableRow key={item.cell}>
                    <TableCell className="text-muted-foreground">{item.labelGuessed || 'N/A'}</TableCell>
                    <TableCell className="font-mono">{item.cell}</TableCell>
                    <TableCell className="font-medium">{item.value}</TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">The AI could not fill any fields automatically.</TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </ScrollArea>
        </div>
      )}
      
      <CorrectionForm 
        processState={processState} 
        masterData={masterData}
        onMasterDataUpdate={onMasterDataUpdate}
      />
      
      <CardFooter className="flex-col gap-4 px-0 pb-0 pt-4">
        {directDownloadUrl && (
           <a href={directDownloadUrl} download={processState.fileName} className="w-full">
             <Button className="w-full" size="lg" variant="outline">
               <Download className="mr-2 h-4 w-4" />
               Download Initial Filled Form
             </Button>
           </a>
        )}
         <Button variant="ghost" onClick={resetFormFill} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4"/>
            Start Over with a new Form
         </Button>
      </CardFooter>
    </CardContent>
  );
}

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [masterData, setMasterData] = useState<Record<string, string> | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        getMasterData(user.uid)
          .then((data) => {
            setMasterData(data);
          })
          .catch((error) => {
            toast({
              variant: "destructive",
              title: "Could not load user data.",
              description: error.message,
            });
          })
          .finally(() => {
            setLoadingData(false);
          });
      } else {
        router.push("/login");
      }
    }
  }, [user, authLoading, router, toast]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const renderContent = () => {
    if (authLoading || loadingData) {
      return (
        <CardContent className="flex justify-center items-center h-64">
          <Loader className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      );
    }
    
    if (user && !masterData) {
      return <InitialSetup onSetupComplete={setMasterData} />;
    }

    if (user && masterData) {
      return <FormFiller masterData={masterData} onMasterDataUpdate={setMasterData} />;
    }

    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="text-center relative">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">Form AutoFill AI</CardTitle>
          <CardDescription className="text-base">
            {masterData ? 'Instantly fill any Excel or PDF form from your master data.' : 'Your personal form-filling assistant.'}
          </CardDescription>
          {user && (
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
        </CardHeader>
        {renderContent()}
      </Card>
    </main>
  );
}
