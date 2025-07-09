
"use client";

import React, { useEffect, useState, useActionState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  User as UserIcon,
  Pencil,
  ArrowLeft,
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

const FileUploadDropzone = ({ file, onFileChange, icon, title, description, inputId, accept, ...props }) => {
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
        accept={accept}
        {...props}
      />
    </label>
  )
}

function CorrectionForm({ processState, masterData, onMasterDataUpdate, onBack }) {
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

       <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4"/>
          Back to Upload
       </Button>
    </form>
  )
}

function InitialSetup({ onSetupComplete }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [setupMode, setSetupMode] = useState<"choice" | "upload" | "manual">("choice");
  const [masterDataFile, setMasterDataFile] = useState<File | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      const isValid = selectedFile && (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".csv"));
      if (isValid) {
        handleParse(selectedFile);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a valid .xlsx or .csv file.",
        });
      }
    }
  };
  
  const parseCsv = (file: File): Promise<Record<string, string>> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const data: Record<string, string> = {};
            const rows = text.split(/\r?\n/);
            rows.forEach(row => {
                const columns = row.split(',');
                if (columns.length >= 2) {
                    const key = columns[0].trim();
                    const value = columns.slice(1).join(',').trim();
                    if(key) data[key] = value;
                }
            });
            if(Object.keys(data).length === 0) {
              reject(new Error("Could not parse any data. Ensure the CSV has at least two columns: key, value."));
            } else {
              resolve(data);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
  }
  
  const parseXlsx = async (file: File): Promise<Record<string, string>> => {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
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
    return data;
  }

  const handleParse = async (file: File) => {
    if (!file || !user) return;
    try {
      let data: Record<string, string>;
      if (file.name.endsWith('.csv')) {
          data = await parseCsv(file);
      } else {
          data = await parseXlsx(file);
      }
      
      await saveMasterData(user.uid, data);
      onSetupComplete(data);
      toast({ title: "Success!", description: "Your master data has been saved from the sheet." });

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Parsing Failed", description: message });
    }
  };
  
  const handleStartManually = () => {
    router.push('/profile');
  };

  if (setupMode === 'choice') {
    return (
       <CardContent className="space-y-4 pt-6">
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>Welcome! Let's get your data setup.</AlertTitle>
          <AlertDescription>
            You can upload an Excel/CSV sheet with your master data, or enter it manually.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" size="lg" className="h-auto py-6 flex flex-col gap-2 hover:bg-accent/50" onClick={() => setSetupMode('upload')}>
                <CloudUpload className="h-8 w-8"/>
                <span>Upload Master Sheet</span>
                <span className="text-xs font-normal text-muted-foreground">(.xlsx or .csv)</span>
            </Button>
            <Button variant="outline" size="lg" className="h-auto py-6 flex flex-col gap-2 hover:bg-accent/50" onClick={handleStartManually}>
                <Pencil className="h-8 w-8"/>
                <span>Enter Data Manually</span>
                <span className="text-xs font-normal text-muted-foreground">We'll start you with some common fields.</span>
            </Button>
        </div>
      </CardContent>
    );
  }

  if (setupMode === 'upload') {
     return (
      <CardContent className="space-y-4 pt-6">
        <FileUploadDropzone
          file={masterDataFile}
          onFileChange={handleFileChange}
          icon={<Database className="h-10 w-10 text-muted-foreground" />}
          title="Upload Master Data Sheet"
          description="Excel (.xlsx) or CSV (.csv) files only"
          inputId="master-data-upload"
          accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
        />
        <Button onClick={() => setSetupMode('choice')} variant="link">Back to options</Button>
      </CardContent>
    );
  }
  
  return null;
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
              title="Upload Form To Fill"
              description="Excel or PDF files only (.xlsx, .pdf)"
              inputId="file"
              name="file"
              required
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .pdf, application/pdf"
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
        onBack={resetFormFill}
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
      </CardFooter>
    </CardContent>
  );
}

const HowItWorksStep = ({ icon, title, description }) => {
    return (
        <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                {icon}
            </div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
        </div>
    );
};


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
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="text-center relative">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <Wand2 className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">Form AutoFill AI</CardTitle>
          <CardDescription className="text-base max-w-2xl mx-auto">
            Auto-fill any form - Excel or PDF - using your saved master data. Works with invoices, onboarding forms, registrations, and more.
          </CardDescription>
          {user && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <Link href="/profile">
                <Button variant="ghost" size="icon" title="Profile">
                    <UserIcon className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
        </CardHeader>
        
        {masterData && (
          <CardContent>
            <div className="my-6 rounded-lg border bg-card p-6">
                <h2 className="text-xl font-semibold text-center mb-6">How It Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <HowItWorksStep icon={<Pencil className="h-6 w-6"/>} title="1. Set Your Data" description="Enter or upload your master data just once on your profile." />
                    <HowItWorksStep icon={<CloudUpload className="h-6 w-6"/>} title="2. Upload a Form" description="Upload any structured form (Excel or PDF)." />
                    <HowItWorksStep icon={<FileCheck className="h-6 w-6"/>} title="3. Download" description="Review, correct, and download the auto-filled version instantly." />
                </div>
            </div>
          </CardContent>
        )}
        
        {renderContent()}
      </Card>
    </main>
  );
}
