
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getMasterData, saveMasterData } from "@/lib/firestore";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader,
  AlertCircle,
  ArrowLeft,
  PlusCircle,
  Trash2,
  Save,
  Upload,
  User,
  Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const defaultFields: Record<string, string> = {
  "Company Name": "",
  "Legal Name": "",
  "Address Line 1": "",
  "City": "",
  "State": "",
  "Zip Code": "",
  "Country": "",
  "Contact Person": "",
  "Contact Email": "",
  "Contact Phone": "",
  "GST Number": "",
  "PAN Number": "",
};

const placeholderData: Record<string, string> = {
    "Company Name": "Innovate Inc.",
    "Legal Name": "Innovate Technologies Inc.",
    "Address Line 1": "123 Tech Park, Suite 101",
    "City": "Techville",
    "State": "California",
    "Zip Code": "94043",
    "Country": "USA",
    "Contact Person": "Jane Doe",
    "Contact Email": "jane.doe@example.com",
    "Contact Phone": "123-456-7890",
    "GST Number": "27ABCDE1234F1Z5",
    "PAN Number": "ABCDE1234F",
    "Bank Name": "Global Tech Bank",
    "Bank Account Number": "123456789012",
    "IFSC Code": "GTBK0000123",
};

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [masterData, setMasterData] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    getMasterData(user.uid)
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setMasterData(data);
        } else {
          // For new users, start with a default set of fields
          setMasterData(defaultFields);
        }
      })
      .catch((err) => {
        setError(err.message);
        toast({
          variant: "destructive",
          title: "Failed to load data",
          description: err.message,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user, authLoading, router, toast]);
  
  const handleFieldChange = (oldKey: string, newKey: string) => {
    setMasterData(prev => {
        if (!prev) return null;

        if (newKey !== oldKey && newKey in prev) {
            toast({
                variant: "destructive",
                title: "Duplicate Field Name",
                description: "Field names must be unique. Please choose a different name."
            });
            return prev; 
        }

        const entries = Object.entries(prev);
        const newEntries = entries.map(([key, value]) => {
            if (key === oldKey) {
                return [newKey, value];
            }
            return [key, value];
        });
        return Object.fromEntries(newEntries);
    });
  };

  const handleValueChange = (key: string, value: string) => {
    setMasterData(prev => ({...prev, [key]: value }));
  };
  
  const handleAddField = () => {
    setMasterData(prev => {
      if (!prev) return { "New Field": "" };
      let i = 1;
      let newFieldName = "New Field";
      while(Object.keys(prev).includes(newFieldName)) {
        newFieldName = `New Field ${i}`;
        i++;
      }
      return { ...prev, [newFieldName]: "" };
    });
  };

  const handleRemoveField = (key: string) => {
    setMasterData(prev => {
        if (!prev) return null;
        const newData = {...prev};
        delete newData[key];
        return newData;
    });
  };
  
  const handleSaveChanges = async () => {
    if (!user || !masterData) return;
    setIsSaving(true);
    try {
      const dataToSave = Object.entries(masterData).reduce((acc, [key, value]) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      }, {});

      await saveMasterData(user.uid, dataToSave);
      setMasterData(dataToSave);
      toast({
        title: "Success!",
        description: "Your master data has been saved.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        let importedData: Record<string, string>;
        if (file.name.endsWith('.csv')) {
            importedData = await parseCsv(file);
        } else if (file.name.endsWith('.xlsx')) {
            importedData = await parseXlsx(file);
        } else {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a .csv or .xlsx file." });
            return;
        }

        setMasterData(prev => ({ ...prev, ...importedData }));
        toast({ title: "Import Successful", description: `${Object.keys(importedData).length} fields were imported. Click 'Save Changes' to confirm.` });
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred during import.";
        toast({ variant: "destructive", title: "Import Failed", description: message });
    }
    event.target.value = '';
  };
  
  const parseCsv = (file: File): Promise<Record<string, string>> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
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
            if(Object.keys(data).length === 0) reject(new Error("No data found in CSV."));
            else resolve(data);
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
      const key = row.getCell(1).text?.trim();
      const value = row.getCell(2).text?.trim() || "";
      if (key) data[key] = value;
    });
    if(Object.keys(data).length === 0) throw new Error("No data found in XLSX.");
    return data;
  };


  if (isLoading || authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <Loader className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 bg-background">
      <Card className="w-full max-w-4xl shadow-2xl bg-card border-border text-foreground">
        <CardHeader>
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <CardTitle className="text-3xl font-bold">Your Profile</CardTitle>
                    <CardDescription className="text-base text-muted-foreground">
                        Manage your user profile and master data for auto-filling forms.
                    </CardDescription>
                </div>
                <Link href="/" passHref>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to App
                    </Button>
                </Link>
            </div>
            {user && (
                 <div className="flex flex-col sm:flex-row gap-4 sm:items-center rounded-lg bg-secondary/50 p-4 border border-border mt-4">
                     <div className="flex items-center gap-3">
                         <User className="h-5 w-5 text-primary"/>
                         <span className="font-medium text-foreground">{user.displayName || 'No Name'}</span>
                     </div>
                      <div className="flex items-center gap-3">
                         <Mail className="h-5 w-5 text-primary"/>
                         <span className="font-medium text-muted-foreground">{user.email}</span>
                     </div>
                 </div>
            )}
        </CardHeader>

        <CardContent className="space-y-6">
            <div>
                 <h3 className="text-xl font-bold text-foreground mb-2">Master Data</h3>
                 <p className="text-muted-foreground mb-4">Add, edit, or import the data fields you want to use for auto-filling.</p>
            </div>
            {error && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {masterData && (
              <ScrollArea className="h-[40vh] w-full">
                <div className="space-y-4 pr-4">
                  <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_auto] items-center gap-4 px-2 pb-2 border-b border-border">
                      <Label className="text-muted-foreground">Field Name</Label>
                      <Label className="text-muted-foreground">Value</Label>
                      <div className="w-8 h-8"/>
                  </div>
                  {Object.entries(masterData).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_auto] items-center gap-4 group">
                      <Input
                          value={key}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          placeholder="Field Name"
                          className="font-semibold bg-background/50 border-border text-foreground"
                      />
                      <Input
                          value={value}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                          placeholder={placeholderData[key] || "Value"}
                          className="bg-background/50 border-border text-foreground"
                      />
                      <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveField(key)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label="Remove field"
                      >
                          <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center border-t border-border pt-6 gap-4">
           <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={handleAddField} className="border-border hover:bg-secondary flex-1 sm:flex-none">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Field
                </Button>
                 <label htmlFor="file-upload" className="cursor-pointer flex-1 sm:flex-none">
                    <Button asChild variant="outline" className="border-border hover:bg-secondary w-full">
                        <span>
                            <Upload className="mr-2 h-4 w-4" /> Import
                        </span>
                    </Button>
                    <Input id="file-upload" type="file" className="hidden" onChange={handleFileImport} accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>
                </label>
           </div>
          <Button onClick={handleSaveChanges} disabled={isSaving || !masterData} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
            {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

    